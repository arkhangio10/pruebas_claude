"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useTrabajadores } from '@/context/TrabajadoresContext';

const FiltroTrabajadores: React.FC = () => {
  const { filtros, aplicarFiltros, recargarDatos, loading } = useTrabajadores();
  const [inicio, setInicio] = useState(filtros.fechaInicio);
  const [fin, setFin] = useState(filtros.fechaFin);
  const [tipoVista, setTipoVista] = useState(filtros.tipoVista || 'diario');
  const [reloading, setReloading] = useState(false);

  useEffect(() => { 
    if (filtros.fechaInicio !== inicio || filtros.fechaFin !== fin || filtros.tipoVista !== tipoVista) {
      setInicio(filtros.fechaInicio); 
      setFin(filtros.fechaFin); 
      setTipoVista(filtros.tipoVista||'diario');
    }
  }, [filtros]);

  // ✅ CORRECCIÓN: Función auxiliar para crear fechas sin problemas de zona horaria
  const crearFechaLocal = (fechaStr: string): Date => {
    const [year, month, day] = fechaStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  };

  const format = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calcularRango = useCallback((base: Date, tv: string): { ini:string; fin:string } => {
    if (tv === 'diario') {
      return { ini: format(base), fin: format(base) };
    }
    
    if (tv === 'semanal') {
      // ✅ CORRECCIÓN: Cálculo consistente del lunes y domingo
      const d = new Date(base);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Si es domingo, retroceder 6 días al lunes
      
      const lunes = new Date(d);
      lunes.setDate(d.getDate() + diff);
      
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      
      return { ini: format(lunes), fin: format(domingo) };
    }
    
    if (tv === 'mensual') {
      const year = base.getFullYear();
      const month = base.getMonth();
      
      const primero = new Date(year, month, 1);
      const ultimo = new Date(year, month + 1, 0);
      
      const hoy = new Date();
      const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth();
      
      if (esMesActual) {
        return { ini: format(primero), fin: format(hoy) };
      } else {
        return { ini: format(primero), fin: format(ultimo) };
      }
    }
    
    return { ini: inicio, fin: fin };
  }, [inicio, fin]);

  function onChangeTipoVista(tv: string) {
    setTipoVista(tv as any);

    if (tv !== 'rango') {
      // ✅ CORRECCIÓN: Usar crearFechaLocal para evitar problemas de timezone
      const base = crearFechaLocal(inicio);
      const { ini, fin: f2 } = calcularRango(base, tv);
      setInicio(ini);
      setFin(f2);
      aplicarFiltros({ tipoVista: tv as any, fechaInicio: ini, fechaFin: f2 });
    } else {
      const hoy = new Date();
      const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const inicioRango = format(mesAnterior);
      const finRango = format(hoy);
      setInicio(inicioRango);
      setFin(finRango);
      aplicarFiltros({ tipoVista: tv as any, fechaInicio: inicioRango, fechaFin: finRango });
    }
  }

  function moverPeriodo(delta: number) {
    let base;

    if (tipoVista === 'mensual') {
      // ✅ CORRECCIÓN: Navegación mensual mejorada
      const fechaActual = crearFechaLocal(inicio);
      const year = fechaActual.getFullYear();
      const month = fechaActual.getMonth();
      
      // Crear nueva fecha con el mes ajustado
      base = new Date(year, month + delta, 1);
      
    } else if (tipoVista === 'diario') {
      // ✅ CORRECCIÓN: Usar crearFechaLocal para navegación diaria
      base = crearFechaLocal(inicio);
      base.setDate(base.getDate() + delta);
      
    } else if (tipoVista === 'semanal') {
      // ✅ CORRECCIÓN: Navegación semanal con fecha local
      base = crearFechaLocal(inicio);
      base.setDate(base.getDate() + (delta * 7));
      
    } else {
      // Para rangos personalizados
      const fechaInicio = crearFechaLocal(inicio);
      const fechaFin = crearFechaLocal(fin);
      const duracionMs = fechaFin.getTime() - fechaInicio.getTime();
      const duracionDias = Math.round(duracionMs / (1000 * 60 * 60 * 24)) + 1;
      
      base = new Date(fechaInicio);
      base.setDate(base.getDate() + (delta * duracionDias));
    }
    
    // Calcular el nuevo rango
    const { ini, fin: f2 } = calcularRango(base, tipoVista);
    
    // Validación para evitar fechas futuras
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999); // Fin del día actual
    
    if (tipoVista !== 'rango') {
      const inicioNuevo = crearFechaLocal(ini);
      
      if (tipoVista === 'mensual') {
        const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
        const mesNuevo = inicioNuevo.getFullYear() * 12 + inicioNuevo.getMonth();
        
        if (delta > 0 && mesNuevo > mesActual) {
          console.log(`No se puede avanzar al mes futuro: ${ini}`);
          return;
        }
      } else if (tipoVista === 'diario') {
        const hoyInicio = new Date(hoy);
        hoyInicio.setHours(0, 0, 0, 0);
        
        if (inicioNuevo > hoyInicio) {
          console.log(`No se puede avanzar a fecha futura: ${ini}`);
          return;
        }
      } else if (tipoVista === 'semanal') {
        const hoyInicio = new Date(hoy);
        hoyInicio.setHours(0, 0, 0, 0);
        
        if (inicioNuevo > hoyInicio) {
          console.log(`No se puede avanzar a semana futura: ${ini}`);
          return;
        }
      }
    }
    
    // Limpiar caché
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('trabajadores:')) localStorage.removeItem(k);
      });
    }
    
    console.log(`Moviendo ${tipoVista} de ${inicio} a ${ini} (delta: ${delta})`);
    setInicio(ini);
    setFin(f2);
    aplicarFiltros({ fechaInicio: ini, fechaFin: f2 });
  }

  function aplicarManual() {
    const fechaInicioDate = crearFechaLocal(inicio);
    const fechaFinDate = crearFechaLocal(fin);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (fechaInicioDate > fechaFinDate) {
      alert('❌ La fecha de inicio no puede ser mayor que la fecha de fin');
      return;
    }
    
    if (fechaFinDate > hoy) {
      alert('❌ La fecha de fin no puede ser mayor que hoy');
      return;
    }
    
    if (fechaInicioDate > hoy) {
      alert('❌ La fecha de inicio no puede ser mayor que hoy');
      return;
    }
    
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('trabajadores:')) localStorage.removeItem(k);
      });
    }
    
    setTipoVista('rango');
    aplicarFiltros({ 
      fechaInicio: inicio, 
      fechaFin: fin, 
      tipoVista: 'rango'
    });
  }
  
  // Etiqueta del periodo actual
  const periodoLabel = (() => {
    if (tipoVista === 'diario') return inicio;
    if (tipoVista === 'semanal') return `${inicio} → ${fin}`;
    
    if (tipoVista === 'mensual') {
      const hoy = new Date();
      const mesHoy = hoy.getFullYear() * 12 + hoy.getMonth();
      
      const fechaInicio = crearFechaLocal(inicio);
      const mesFiltro = fechaInicio.getFullYear() * 12 + fechaInicio.getMonth();
      
      if (mesFiltro === mesHoy) {
        return `${inicio.slice(0,7)} (Parcial)`;
      }
      return inicio.slice(0,7);
    }
    
    if (tipoVista === 'rango') return `${inicio} → ${fin}`;
    return '';
  })();

  // Control de deshabilitado para botón avanzar
  const disableForward = (() => {
    if (tipoVista === 'rango') return false;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (tipoVista === 'diario') {
      const inicioDate = crearFechaLocal(inicio);
      return inicioDate >= hoy;
    }
    
    if (tipoVista === 'mensual') {
      const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
      const inicioDate = crearFechaLocal(inicio);
      const mesInicio = inicioDate.getFullYear() * 12 + inicioDate.getMonth();
      return mesInicio >= mesActual;
    }
    
    if (tipoVista === 'semanal') {
      const inicioDate = crearFechaLocal(inicio);
      const siguienteSemana = new Date(inicioDate);
      siguienteSemana.setDate(inicioDate.getDate() + 7);
      return siguienteSemana > hoy;
    }
    
    return false;
  })();

  return (
    <div className="bg-gray-50 rounded-lg shadow-md p-4 border border-gray-300 flex flex-col md:flex-row md:items-end gap-4 mb-6">
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs text-gray-700 font-medium">Vista (Trabajadores)</label>
        <select 
          value={tipoVista} 
          onChange={e=>onChangeTipoVista(e.target.value)} 
          className="border rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="diario">Diario</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
          <option value="rango">Rango Manual</option>
        </select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-700 font-medium">Desde</label>
        <input 
          disabled={tipoVista!=='rango'} 
          type="date" 
          value={inicio} 
          onChange={e=>setInicio(e.target.value)} 
          className="border rounded-md px-2 py-1 text-sm bg-white disabled:bg-gray-100" 
        />
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-700 font-medium">Hasta</label>
        <input 
          disabled={tipoVista!=='rango'} 
          type="date" 
          value={fin} 
          onChange={e=>setFin(e.target.value)} 
          className="border rounded-md px-2 py-1 text-sm bg-white disabled:bg-gray-100" 
        />
      </div>
      
      <div className="flex gap-2 items-center mt-2 md:mt-0">
        <button 
          onClick={()=>moverPeriodo(-1)} 
          className="px-2 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-100"
        >◀</button>
        <button 
          onClick={()=>!disableForward && moverPeriodo(1)} 
          disabled={disableForward} 
          className={`px-2 py-1.5 text-sm rounded-md border bg-white ${disableForward ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100'}`}
        >▶</button>
      </div>
      
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs text-gray-700 font-medium">Periodo</label>
        <div 
          className="text-xs px-2 py-1 rounded-md border bg-white font-mono" 
          title={periodoLabel}
        >{periodoLabel}</div>
      </div>
      
      {tipoVista==='rango' && 
        <button 
          onClick={aplicarManual} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm shadow"
        >Aplicar</button>
      }
      
      <div className="flex gap-2">
        <button 
          onClick={async () => {
            if (typeof window !== 'undefined') {
              Object.keys(localStorage).forEach(k => {
                if (k.startsWith('trabajadores:')) localStorage.removeItem(k);
              });
            }
            
            setReloading(true);
            try {
              await recargarDatos();
            } finally {
              setTimeout(() => setReloading(false), 500);
            }
          }} 
          disabled={loading || reloading}
          className={`${loading || reloading ? 'bg-gray-500' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-md text-sm shadow flex items-center gap-1`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading || reloading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading || reloading ? 'Actualizando...' : 'Recargar'}
        </button>
      </div>
    </div>
  );
};

export default FiltroTrabajadores;