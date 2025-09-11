"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useReportes } from '@/context/ReportesContext';
import { useRouter } from 'next/navigation';

// Extender la interfaz Window para permitir nuestra propiedad personalizada
declare global {
  interface Window {
    __lastReportesReloadTime?: number;
  }
}

const FiltroReportes: React.FC = () => {
  const router = useRouter();
  const { filtros, aplicarFiltros, recargarDatos, loading, listaSubcontratistas } = useReportes();
  const [inicio, setInicio] = useState(filtros.fechaInicio);
  const [fin, setFin] = useState(filtros.fechaFin);
  const [estado, setEstado] = useState(filtros.estado);
  const [subcontratista, setSubcontratista] = useState(filtros.subcontratista);
  const [reloading, setReloading] = useState(false);

  useEffect(() => { 
    setInicio(filtros.fechaInicio); 
    setFin(filtros.fechaFin);
    setEstado(filtros.estado);
    setSubcontratista(filtros.subcontratista);
    
  // Determinar el tipo de periodo basado en las fechas del filtro
  const inicioDate = parse(filtros.fechaInicio);
  const finDate = parse(filtros.fechaFin);
    
    // Si es el mismo día, es modo diario
    if (filtros.fechaInicio === filtros.fechaFin) {
      setTipoPeriodo('dia');
    } 
    // Si están en la misma semana
    else if (esLaMismaSemana(inicioDate, finDate)) {
      setTipoPeriodo('semana');
    }
    // Si están en el mismo mes
    else if (inicioDate.getMonth() === finDate.getMonth() && 
             inicioDate.getFullYear() === finDate.getFullYear()) {
      setTipoPeriodo('mes');
    }
    // Si están en el mismo trimestre
    else if (Math.floor(inicioDate.getMonth() / 3) === Math.floor(finDate.getMonth() / 3) &&
             inicioDate.getFullYear() === finDate.getFullYear()) {
      setTipoPeriodo('trimestre');
    }
  }, [filtros]);

  // Helpers: formateo/parsing local para evitar desfaces por UTC
  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y || 1970, (m ? m - 1 : 0), d || 1);
  };

  // Estado para almacenar el tipo de periodo actual (similar a tipoVista en los otros componentes)
  const [tipoPeriodo, setTipoPeriodo] = useState<string>('mes');
  
  const calcularRango = useCallback((base: Date, periodo: string): { ini:string; fin:string } => {
    // Clonar la fecha base para evitar modificar la original
    const d = new Date(base);
    
    // Normalizar la fecha para evitar problemas con la zona horaria
    // Al trabajar solo con la fecha (sin hora)
    d.setHours(0, 0, 0, 0);
    
    // No modificamos el estado aquí para evitar efectos secundarios
  console.log(`Calculando rango para periodo ${periodo} con base ${format(d)}`);
    
    if (periodo === 'dia') {
      // Para vista diaria, inicio y fin son el mismo día
      return { ini: format(d), fin: format(d) };
    }
    
    if (periodo === 'semana') {
      // Para vista semanal, del lunes al domingo (igual a trabajadores/productividad)
      const day = d.getDay(); // 0 es domingo, 1 es lunes, etc.
      const diff = (day === 0 ? -6 : 1 - day); // Ajustar para que la semana comience el lunes
      
      const lunes = new Date(d);
      lunes.setDate(d.getDate() + diff);
      
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      
      return { ini: format(lunes), fin: format(domingo) };
    }
    
    if (periodo === 'mes') {
      // Para vista mensual, del primer al último día del mes
      const primero = new Date(d.getFullYear(), d.getMonth(), 1);
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { ini: format(primero), fin: format(ultimo) };
    }
    
    if (periodo === 'trimestre') {
      // Para vista trimestral, tres meses completos
      // CORREGIDO: Asegurarnos que el último día sea el correcto
      const mes = d.getMonth();
      const trimestre = Math.floor(mes / 3);
      const primerMesTrimestre = trimestre * 3;
      
      const primero = new Date(d.getFullYear(), primerMesTrimestre, 1);
      // Corregido: asegurarnos de obtener correctamente el último día del tercer mes
      const ultimoMes = primerMesTrimestre + 2; // 0, 1, 2 para el primer trimestre
      const ultimo = new Date(d.getFullYear(), ultimoMes + 1, 0);
      
      return { ini: format(primero), fin: format(ultimo) };
    }
    
    // Si no es ninguno de los periodos predefinidos, mantener las fechas actuales
    return { ini: inicio, fin: fin };
  }, [inicio, fin]);
  
  // Función para calcular el rango previo
  const calcularRangoPrevio = useCallback((fecha: Date, periodo: string): { ini:string; fin:string } => {
    const nuevaFecha = new Date(fecha);
    
    if (periodo === 'dia') {
      nuevaFecha.setDate(fecha.getDate() - 1);
    } else if (periodo === 'semana') {
      nuevaFecha.setDate(fecha.getDate() - 7);
    } else if (periodo === 'mes') {
      nuevaFecha.setMonth(fecha.getMonth() - 1);
    } else if (periodo === 'trimestre') {
      nuevaFecha.setMonth(fecha.getMonth() - 3);
    } else {
      return { ini: inicio, fin };
    }
    
    return calcularRango(nuevaFecha, periodo);
  }, [calcularRango, inicio, fin]);
  
  // Función para navegar al periodo anterior
  const irPeriodoAnterior = useCallback(() => {
    if (inicio === '') return;

    const baseInicio = parse(inicio);
    const { ini, fin: f2 } = calcularRangoPrevio(baseInicio, tipoPeriodo);
    console.log(`Periodo anterior: ${ini} - ${f2} (tipoPeriodo: ${tipoPeriodo})`);
    
    // Actualizar estados locales primero
    setInicio(ini);
    setFin(f2);
    
    // Luego aplicar al contexto global con un pequeño delay para evitar race conditions
    setTimeout(() => {
      aplicarFiltros({ fechaInicio: ini, fechaFin: f2 });
    }, 0);
  }, [inicio, tipoPeriodo, calcularRangoPrevio, aplicarFiltros]);
  
  // Función para calcular el rango siguiente
  const calcularRangoSiguiente = useCallback((fecha: Date, periodo: string): { ini:string; fin:string } => {
    const nuevaFecha = new Date(fecha);
    
    if (periodo === 'dia') {
      nuevaFecha.setDate(fecha.getDate() + 1);
    } else if (periodo === 'semana') {
      nuevaFecha.setDate(fecha.getDate() + 7);
    } else if (periodo === 'mes') {
      nuevaFecha.setMonth(fecha.getMonth() + 1);
    } else if (periodo === 'trimestre') {
      nuevaFecha.setMonth(fecha.getMonth() + 3);
    } else {
      return { ini: inicio, fin };
    }
    
    return calcularRango(nuevaFecha, periodo);
  }, [calcularRango, inicio, fin]);

  // Función para navegar al periodo siguiente
  const irPeriodoSiguiente = useCallback(() => {
    if (inicio === '') return;

    const baseInicio = parse(inicio);
    const { ini, fin: f2 } = calcularRangoSiguiente(baseInicio, tipoPeriodo);
    
    // Si estamos navegando hacia el futuro, asegurarnos de no ir más allá de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const iniDate = parse(ini);
    iniDate.setHours(0, 0, 0, 0);

    // Bloquear solo periodos cuyo inicio esté en el futuro
    if (iniDate > hoy) {
      console.log('No se puede avanzar a un periodo futuro');
      return;
    }
    
    console.log(`Periodo siguiente: ${ini} - ${f2} (tipoPeriodo: ${tipoPeriodo})`);
    
    // Actualizar estados locales primero
    setInicio(ini);
    setFin(f2);
    
    // Luego aplicar al contexto global con un pequeño delay para evitar race conditions
    setTimeout(() => {
      aplicarFiltros({ fechaInicio: ini, fechaFin: f2 });
    }, 0);
  }, [inicio, tipoPeriodo, calcularRangoSiguiente, aplicarFiltros]);

  // Función dedicada para cambiar el tipo de periodo (similar a onChangeTipoVista en otros componentes)
  function onChangeTipoPeriodo(periodo: string) {
    // Primero actualizamos el estado local
    setTipoPeriodo(periodo);
    
    // Si estamos aplicando el periodo "día", usar la fecha actual
    // En vez de usar new Date() que podría incluir la hora actual
    // usamos una fecha específica para evitar problemas de zona horaria
    const hoy = new Date();
    
    // IMPORTANTE: Para mantener la consistencia, usaremos la fecha actual o la fecha
    // en la que estamos posicionados actualmente (inicio)
    const base = periodo === 'rango' 
      ? parse(inicio) 
      : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    
    if (periodo !== 'rango') {
      const { ini, fin: f2 } = calcularRango(base, periodo);
      console.log(`Cambiando a periodo ${periodo}: ${ini} - ${f2}`);
      
      // Actualizar estados locales y contexto global en una secuencia clara
      setInicio(ini); 
      setFin(f2);
      
      // Aplicar los cambios al contexto global
      setTimeout(() => {
        aplicarFiltros({ fechaInicio: ini, fechaFin: f2 });
      }, 0);
    }
  }
  
  // Función para aplicar un periodo específico (mantener para compatibilidad)
  function aplicarPeriodo(periodo: string) {
    onChangeTipoPeriodo(periodo);
  }

  function aplicarFiltrosManual() {
    // Determinar el tipo de periodo basado en las fechas seleccionadas
  const inicioDate = parse(inicio);
  const finDate = parse(fin);
    
    let nuevoTipoPeriodo = 'rango'; // Por defecto
    
    // Si es el mismo día, es modo diario
    if (inicio === fin) {
      nuevoTipoPeriodo = 'dia';
    } 
    // Si están en la misma semana
    else if (esLaMismaSemana(inicioDate, finDate)) {
      nuevoTipoPeriodo = 'semana';
    }
    // Si están en el mismo mes
    else if (inicioDate.getMonth() === finDate.getMonth() && 
             inicioDate.getFullYear() === finDate.getFullYear()) {
      nuevoTipoPeriodo = 'mes';
    }
    // Si están en el mismo trimestre
    else if (Math.floor(inicioDate.getMonth() / 3) === Math.floor(finDate.getMonth() / 3) &&
             inicioDate.getFullYear() === finDate.getFullYear()) {
      nuevoTipoPeriodo = 'trimestre';
    }
    
    // Actualizar el tipo de periodo si ha cambiado
    if (tipoPeriodo !== nuevoTipoPeriodo) {
      setTipoPeriodo(nuevoTipoPeriodo);
    }
    
    console.log(`Aplicando filtros manualmente: ${inicio} - ${fin}, tipo periodo: ${nuevoTipoPeriodo}`);
    console.log(`Estado: ${estado}, Subcontratista: ${subcontratista}`);
    
    // Aplicar los filtros seleccionados con un pequeño delay para evitar race conditions
    setTimeout(() => {
      aplicarFiltros({ 
        fechaInicio: inicio, 
        fechaFin: fin, 
        estado,
        subcontratista
      });
    }, 0);
  }
  
  // Función auxiliar para determinar si dos fechas están en la misma semana
  function esLaMismaSemana(d1: Date, d2: Date): boolean {
    // Clonar las fechas para no modificar las originales
    const fecha1 = new Date(d1);
    const fecha2 = new Date(d2);
    
    // Obtener el inicio de la semana para cada fecha (lunes)
    const day1 = fecha1.getDay();
    const diff1 = (day1 === 0 ? -6 : 1 - day1);
    fecha1.setDate(fecha1.getDate() + diff1);
    
    const day2 = fecha2.getDay();
    const diff2 = (day2 === 0 ? -6 : 1 - day2);
    fecha2.setDate(fecha2.getDate() + diff2);
    
    // Si los inicios de semana tienen el mismo año, mes y día, están en la misma semana
    return fecha1.getFullYear() === fecha2.getFullYear() &&
           fecha1.getMonth() === fecha2.getMonth() &&
           fecha1.getDate() === fecha2.getDate();
  }

  // Etiqueta legible del periodo actual
  const periodoLabel = (() => {
    // Asegurarse de que estamos trabajando con fechas válidas y actualizadas
  const inicioDate = parse(inicio);
  const finDate = parse(fin);

    // Para modo diario, mostrar solo la fecha
    if (tipoPeriodo === 'dia' || inicio === fin) {
      return formatoCorto(inicioDate);
    }
    
    // Para vista semanal
    if (tipoPeriodo === 'semana') {
      return `${formatoCorto(inicioDate)} - ${formatoCorto(finDate)}`;
    }
    
    // Para vista mensual
    if (tipoPeriodo === 'mes') {
      const mes = inicioDate.toLocaleDateString('es-ES', { month: 'long' });
      return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${inicioDate.getFullYear()}`;
    }
    
    // Para trimestre
    if (tipoPeriodo === 'trimestre') {
      const trimestre = Math.floor(inicioDate.getMonth() / 3) + 1;
      return `${trimestre}T ${inicioDate.getFullYear()}`;
    }
    
    // Para cualquier otro caso, mostrar el rango completo
    return `${formatoCorto(inicioDate)} - ${formatoCorto(finDate)}`;
  })();
  
  // Función auxiliar para formatear fechas
  function formato(fecha: Date, tipo: 'corto' | 'completo' = 'completo') {
    if (tipo === 'corto') {
      return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
    }
    return fecha.toLocaleDateString('es-ES', { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  // Función específica para formato corto de fechas
  function formatoCorto(fecha: Date) {
    return fecha.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-700">Análisis de Reportes</h2>
      
      {/* Primera fila: similares al diseño de la imagen 2 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700 font-medium">Vista (Reportes)</label>
          <select
            className="border rounded-md px-2 py-1.5 text-sm bg-white"
            onChange={(e) => {
              if (e.target.value === 'mensual') {
                onChangeTipoPeriodo('mes');
              } else if (e.target.value === 'semanal') {
                onChangeTipoPeriodo('semana');
              } else if (e.target.value === 'trimestral') {
                onChangeTipoPeriodo('trimestre');
              } else if (e.target.value === 'diaria') {
                onChangeTipoPeriodo('dia');
              }
            }}
            value={tipoPeriodo === 'mes' ? 'mensual' : tipoPeriodo === 'semana' ? 'semanal' : tipoPeriodo === 'trimestre' ? 'trimestral' : 'diaria'}
          >
            <option value="mensual">Mensual</option>
            <option value="semanal">Semanal</option>
            <option value="trimestral">Trimestral</option>
            <option value="diaria">Diaria</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700 font-medium">Desde</label>
          <input 
            type="date" 
            value={inicio} 
            onChange={(e) => {
              const newValue = e.target.value;
              setInicio(newValue);
              
              // Si la fecha inicio es igual a la fecha fin, estamos en modo diario
              if (newValue === fin) {
                setTipoPeriodo('dia');
              } 
              // Si no, determinar automáticamente el tipo de periodo
              else {
                const inicioDate = parse(newValue);
                const finDate = parse(fin);
                
                // Si es el mismo día
                if (newValue === fin) {
                  setTipoPeriodo('dia');
                } 
                // Si están en la misma semana
                else if (esLaMismaSemana(inicioDate, finDate)) {
                  setTipoPeriodo('semana');
                }
                // Si es mismo mes
                else if (inicioDate.getMonth() === finDate.getMonth() && 
                    inicioDate.getFullYear() === finDate.getFullYear()) {
                  setTipoPeriodo('mes');
                }
                // Si están en el mismo trimestre
                else if (Math.floor(inicioDate.getMonth() / 3) === Math.floor(finDate.getMonth() / 3) &&
                         inicioDate.getFullYear() === finDate.getFullYear()) {
                  setTipoPeriodo('trimestre');
                }
                else {
                  setTipoPeriodo('rango');
                }
              }
              
              // Actualizar el contexto global con un pequeño delay
              setTimeout(() => {
                aplicarFiltros({ fechaInicio: newValue });
              }, 0);
            }} 
            className="border rounded-md px-2 py-1.5 text-sm bg-white" 
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700 font-medium">Hasta</label>
          <input 
            type="date" 
            value={fin} 
            onChange={(e) => {
              const newValue = e.target.value;
              setFin(newValue);
              
              // Si la fecha fin es igual a la fecha inicio, estamos en modo diario
              if (inicio === newValue) {
                setTipoPeriodo('dia');
              }
              // Si no, determinar automáticamente el tipo de periodo
              else {
                const inicioDate = parse(inicio);
                const finDate = parse(newValue);
                
                // Si es el mismo día
                if (inicio === newValue) {
                  setTipoPeriodo('dia');
                } 
                // Si están en la misma semana
                else if (esLaMismaSemana(inicioDate, finDate)) {
                  setTipoPeriodo('semana');
                }
                // Si es mismo mes
                else if (inicioDate.getMonth() === finDate.getMonth() && 
                    inicioDate.getFullYear() === finDate.getFullYear()) {
                  setTipoPeriodo('mes');
                }
                // Si están en el mismo trimestre
                else if (Math.floor(inicioDate.getMonth() / 3) === Math.floor(finDate.getMonth() / 3) &&
                         inicioDate.getFullYear() === finDate.getFullYear()) {
                  setTipoPeriodo('trimestre');
                }
                else {
                  setTipoPeriodo('rango');
                }
              }
              
              // Actualizar el contexto global con un pequeño delay
              setTimeout(() => {
                aplicarFiltros({ fechaFin: newValue });
              }, 0);
            }}
            className="border rounded-md px-2 py-1.5 text-sm bg-white" 
          />
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700 font-medium">Estado</label>
          <select 
            value={estado} 
            onChange={e => {
              const newValue = e.target.value;
              setEstado(newValue);
              aplicarFiltros({ estado: newValue });
            }} 
            className="border rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="TODOS">Todos</option>
            <option value="PROCESADO">Procesado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="ERROR">Con error</option>
            <option value="ERROR_CRITICO">Error crítico</option>
          </select>
        </div>
      </div>
      
      {/* Segunda fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700 font-medium">Subcontratista</label>
          <select 
            value={subcontratista} 
            onChange={e => {
              const newValue = e.target.value;
              setSubcontratista(newValue);
              aplicarFiltros({ subcontratista: newValue });
            }} 
            className="border rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="TODOS">Todos</option>
            {listaSubcontratistas.map(sc => (
              <option key={sc} value={sc}>{sc}</option>
            ))}
          </select>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-700 font-medium">Periodo</label>
          <div className="flex items-center">
            <div 
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-l-md"
              title={`Rango actual: ${formatoCorto(parse(inicio))} - ${formatoCorto(parse(fin))}`}
            >
              {periodoLabel}
            </div>
            <div className="flex">
              <button 
                className="p-1.5 bg-gray-100 border-t border-b border-r hover:bg-gray-200"
                title={`Periodo anterior (${tipoPeriodo === 'dia' ? 'día anterior' : tipoPeriodo === 'semana' ? 'semana anterior' : tipoPeriodo === 'mes' ? 'mes anterior' : 'trimestre anterior'})`}
                onClick={irPeriodoAnterior}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button 
                className="p-1.5 bg-gray-100 border-t border-b border-r hover:bg-gray-200 rounded-r-md"
                title={`Periodo siguiente (${tipoPeriodo === 'dia' ? 'día siguiente' : tipoPeriodo === 'semana' ? 'semana siguiente' : tipoPeriodo === 'mes' ? 'mes siguiente' : 'trimestre siguiente'})`}
                onClick={irPeriodoSiguiente}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Botones de acción */}
      <div className="mt-4 flex justify-between gap-2">
        <button 
          onClick={() => router.push('/dashboard/reportes/nuevo')} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Reporte
        </button>
        
        <div className="flex gap-2">
          <button 
            onClick={aplicarFiltrosManual} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
          >
            Aplicar Filtros
          </button>
          
          <button 
            onClick={async () => {
              // Evitar iniciar nueva carga si ya hay una en curso
              if (loading || reloading) {
                console.log("Evitando recarga manual mientras hay otra carga en curso");
                return;
              }
              
              // Añadir retraso entre recargas para evitar sobrecargar la API
              const now = Date.now();
              const lastReloadTime = window.__lastReportesReloadTime || 0;
              if (now - lastReloadTime < 2000) {
                console.log("Evitando recargas rápidas consecutivas");
                return;
              }
              
              // Actualizar marca de tiempo
              window.__lastReportesReloadTime = now;
              
              setReloading(true);
              try {
                // Limpiar cualquier caché de localStorage para obtener datos frescos
                if (typeof window !== 'undefined') {
                  Object.keys(localStorage).forEach(k => {
                    if (k.startsWith('reportes:')) localStorage.removeItem(k);
                  });
                }
                
                // Forzar recarga completa
                await recargarDatos();
              } finally {
                setTimeout(() => setReloading(false), 800);
              }
            }} 
            disabled={loading || reloading}
            className={`${loading || reloading ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'} text-white px-3 py-1.5 rounded text-sm flex items-center gap-1`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading || reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading || reloading ? 'Actualizando...' : 'Recargar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FiltroReportes;
