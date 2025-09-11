"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useProductividad } from '@/context/ProductividadContext';

const FiltroProductividad: React.FC = () => {
  const { filtros, aplicarFiltros, recargarDatos, loading } = useProductividad();
  const [inicio, setInicio] = useState(filtros.fechaInicio);
  const [fin, setFin] = useState(filtros.fechaFin);
  const [tipoVista, setTipoVista] = useState(filtros.tipoVista);
  const [reloading, setReloading] = useState(false);

  // ✅ FIX: Solo sincronizar cuando el contexto cambia desde fuera (no desde este componente)
  useEffect(()=>{ 
    // Solo actualizar si las fechas del contexto son diferentes a las locales
    // Esto evita bucles infinitos cuando este componente actualiza el contexto
    if (filtros.fechaInicio !== inicio || filtros.fechaFin !== fin || filtros.tipoVista !== tipoVista) {
      setInicio(filtros.fechaInicio); 
      setFin(filtros.fechaFin); 
      setTipoVista(filtros.tipoVista);
    }
  },[filtros]);

  const format = (d: Date) => d.toISOString().slice(0,10);

  const calcularRango = useCallback((base: Date, tv: string): { ini:string; fin:string } => {
    const d = new Date(base);
    if (tv === 'diario') return { ini: format(d), fin: format(d) };
    if (tv === 'semanal') {
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      const lunes = new Date(d); lunes.setDate(d.getDate() + diff);
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { ini: format(lunes), fin: format(domingo) };
    }
    if (tv === 'mensual') {
      // ✅ FIX: Usar UTC para consistencia con el backend
      const year = d.getFullYear();
      const month = d.getMonth();
      
      const primero = new Date(Date.UTC(year, month, 1));
      const ultimo = new Date(Date.UTC(year, month + 1, 0));
      
      // Verificar si es el mes actual para manejar mes parcial
      const hoy = new Date();
      const esMesActual = year === hoy.getFullYear() && month === hoy.getMonth();
      
      if (esMesActual) {
        // Para el mes actual, usar hasta hoy
        return { ini: format(primero), fin: format(hoy) };
      } else {
        // Para meses pasados, usar el mes completo
        return { ini: format(primero), fin: format(ultimo) };
      }
    }
    return { ini: inicio, fin: fin };
  }, [inicio, fin]);

  function onChangeTipoVista(tv: string){
    // ✅ FIX: Solo actualizar el tipo de vista en el estado local
    setTipoVista(tv as any);

    // ✅ FIX: Si la vista NO es 'rango', calcular y aplicar el filtro automáticamente
    if (tv !== 'rango') {
      const base = new Date(inicio);
      const { ini, fin: f2 } = calcularRango(base, tv);
      setInicio(ini);
      setFin(f2);
      // Aplica el filtro completo al contexto
      aplicarFiltros({ tipoVista: tv as any, fechaInicio: ini, fechaFin: f2 });
    } else {
      // ✅ FIX: Al cambiar a 'rango', establecer un rango inicial lógico y aplicarlo al contexto
      const hoy = new Date();
      const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const inicioRango = format(mesAnterior);
      const finRango = format(hoy);
      setInicio(inicioRango);
      setFin(finRango);
      // ✅ FIX: Aplicar inmediatamente al contexto para sincronizar
      aplicarFiltros({ tipoVista: tv as any, fechaInicio: inicioRango, fechaFin: finRango });
    }
  }

  function moverPeriodo(delta:number){
    // ✅ FIX: Navegación mensual simplificada y más confiable
    let base;
    
    if (tipoVista === 'mensual') {
      // Extraer año y mes del inicio actual
      const year = parseInt(inicio.slice(0, 4));
      const month = parseInt(inicio.slice(5, 7)) - 1; // Convertir a base 0
      
      // ✅ FIX: Navegación mensual simplificada
      const nuevoMes = month + delta;
      const nuevoAño = year + Math.floor(nuevoMes / 12);
      const mesNormalizado = ((nuevoMes % 12) + 12) % 12; // Manejar meses negativos
      
      // Crear fecha en el primer día del mes correspondiente
      base = new Date(nuevoAño, mesNormalizado, 1);
      
    } else if (tipoVista === 'diario') {
      base = new Date(inicio);
      base.setDate(base.getDate() + delta);
    } else if (tipoVista === 'semanal') {
      base = new Date(inicio);
      base.setDate(base.getDate() + delta * 7);
    } else {
      // Para rangos personalizados
      const dur = (new Date(fin).getTime() - new Date(inicio).getTime()) / (1000*60*60*24);
      base = new Date(inicio);
      base.setDate(base.getDate() + delta*(dur+1));
    }
    
    // Calcular el nuevo rango basado en la fecha actualizada
    const { ini, fin: f2 } = calcularRango(base, tipoVista);
    
    // ✅ FIX: Validación simplificada para evitar futuro
    const hoy = new Date(); 
    hoy.setHours(0,0,0,0);
    
    if (tipoVista !== 'rango') {
      const inicioNuevo = new Date(ini);
      
      // Para mensual, verificar que no estemos en un mes futuro
      if (tipoVista === 'mensual') {
        const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
        const mesNuevo = inicioNuevo.getFullYear() * 12 + inicioNuevo.getMonth();
        
        // Solo permitir avanzar si no estamos en el mes actual o futuro
        if (delta > 0 && mesNuevo > mesActual) {
          console.log(`No se puede avanzar al mes futuro: ${ini}`);
          return;
        }
      } else {
        // Para diario y semanal, verificar fecha
        if (inicioNuevo > hoy) {
          console.log(`No se puede avanzar a fecha futura: ${ini}`);
          return;
        }
      }
    }
    
    // Limpiar el caché de localStorage para forzar recarga en cambio de periodo
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('productividad:')) localStorage.removeItem(k);
      });
    }
    
    // Actualizar estado y aplicar filtros
    console.log(`Moviendo ${tipoVista} de ${inicio} a ${ini} (delta: ${delta})`);
    setInicio(ini); setFin(f2);
    aplicarFiltros({ fechaInicio: ini, fechaFin: f2 });
  }

  function aplicarManual(){ 
    // ✅ FIX: Validar fechas antes de aplicar
    const fechaInicioDate = new Date(inicio + 'T00:00:00');
    const fechaFinDate = new Date(fin + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    // Validaciones
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
    
    // ✅ FIX: Limpiar caché antes de aplicar filtros para forzar recarga
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('productividad:')) localStorage.removeItem(k);
      });
    }
    
    // ✅ FIX: Actualizar estado local para mantener sincronización
    setTipoVista('rango');
    
    // ✅ SOLUCIÓN: Forzar tipoVista a 'rango' cuando se aplica manualmente
    aplicarFiltros({ 
      fechaInicio: inicio, 
      fechaFin: fin, 
      tipoVista: 'rango'  // <-- Cambio clave aquí
    });
  }

  // Etiqueta legible del periodo actual
  const periodoLabel = (() => {
    if (tipoVista === 'diario') return inicio;
    if (tipoVista === 'semanal') return `${inicio} → ${fin}`;
    
    if (tipoVista === 'mensual') {
      // Para vista mensual, ver si es el mes actual y marcarlo como parcial
      const hoy = new Date();
      const mesHoy = hoy.getFullYear() * 12 + hoy.getMonth();
      
      const year = parseInt(inicio.slice(0, 4));
      const month = parseInt(inicio.slice(5, 7)) - 1;
      const mesFiltro = year * 12 + month;
      
      if (mesFiltro === mesHoy) {
        // Es el mes actual, marcar como parcial
        return `${inicio.slice(0,7)} (Parcial)`;
      }
      return inicio.slice(0,7); // YYYY-MM
    }
    
    if (tipoVista === 'rango') return `${inicio} → ${fin}`;
    return '';
  })();

  // Control de deshabilitado para botón avanzar (no permitir futuro)
  const disableForward = (() => {
    if (tipoVista === 'rango') return false;
    
    const hoy = new Date(); 
    hoy.setHours(0,0,0,0);
    
    // Para vistas mensuales, comparamos a nivel de mes
    if (tipoVista === 'mensual') {
      const mesActual = hoy.getFullYear() * 12 + hoy.getMonth();
      
      // Obtenemos el mes del inicio
      const year = parseInt(inicio.slice(0, 4));
      const month = parseInt(inicio.slice(5, 7)) - 1; // Convertir a base 0
      const mesActualFiltro = year * 12 + month;
      
      // Deshabilitar si ya estamos en el mes actual o futuro
      return mesActualFiltro >= mesActual;
    } 
    // Para diario y semanal, comparamos fechas
    else {
      let base = new Date(inicio);
      if (tipoVista === 'diario') base.setDate(base.getDate() + 1);
      else if (tipoVista === 'semanal') base.setDate(base.getDate() + 7);
      
      // Si la fecha base ya es hoy o está en el futuro, deshabilitar
      return base >= hoy;
    }
  })();

  return (
    <div className="bg-gray-50 rounded-lg shadow-md p-4 border border-gray-300 flex flex-col md:flex-row md:items-end gap-4">
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs text-gray-700 font-medium">Vista (Productividad)</label>
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
          className={`px-2 py-1.5 text-sm rounded-md border bg-white ${disableForward? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100'}`}
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
      
      <button 
        onClick={async () => {
          // Limpiar todo el caché relacionado con productividad
          if (typeof window !== 'undefined') {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith('productividad:')) localStorage.removeItem(k);
            });
          }
          
          setReloading(true);
          try {
            // Forzar recarga completa
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
  );
};

export default FiltroProductividad;
