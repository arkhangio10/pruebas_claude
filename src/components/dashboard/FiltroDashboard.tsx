"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useDashboard } from '@/context/DashboardContext';

const FiltroDashboard: React.FC = () => {
  const { filtros, aplicarFiltros, recargarDatos } = useDashboard();
  const [inicio, setInicio] = useState(filtros.fechaInicio);
  const [fin, setFin] = useState(filtros.fechaFin);
  const [tipoVista, setTipoVista] = useState(filtros.tipoVista || 'diario');

  useEffect(()=>{ setInicio(filtros.fechaInicio); setFin(filtros.fechaFin); setTipoVista(filtros.tipoVista||'diario'); },[filtros]);

  const format = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calcularRango = useCallback((base: Date, tv: string): { ini:string; fin:string } => {
    const d = new Date(base);
    if (tv === 'diario') {
      return { ini: format(d), fin: format(d) };
    }
    if (tv === 'semanal') {
      const day = d.getDay(); // 0 domingo
      const diff = (day === 0 ? -6 : 1 - day); // mover a lunes
      const lunes = new Date(d); lunes.setDate(d.getDate() + diff);
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { ini: format(lunes), fin: format(domingo) };
    }
    if (tv === 'mensual') {
      const primero = new Date(d.getFullYear(), d.getMonth(), 1);
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { ini: format(primero), fin: format(ultimo) };
    }
    // rango manual: mantener lo que hay
    return { ini: inicio, fin: fin };
  }, [inicio, fin]);

  // Ajustar fechas automáticamente al cambiar tipo vista (excepto rango manual)
  function onChangeTipoVista(tv: string) {
    setTipoVista(tv as any);
    if (tv !== 'rango') {
      const base = new Date(inicio);
      const { ini, fin } = calcularRango(base, tv);
      setInicio(ini); setFin(fin);
      aplicarFiltros({ tipoVista: tv as any, fechaInicio: ini, fechaFin: fin });
      recargarDatos();
    } else {
      aplicarFiltros({ tipoVista: tv as any });
    }
  }

  function moverPeriodo(delta: number) {
    let base = new Date(inicio);
    if (tipoVista === 'diario') {
      base.setDate(base.getDate() + delta);
    } else if (tipoVista === 'semanal') {
      base.setDate(base.getDate() + delta * 7);
    } else if (tipoVista === 'mensual') {
      const currentMonth = base.getMonth();
      base.setMonth(currentMonth + delta);
      base.setDate(1); // Asegurar inicio del mes
    } else {
      // rango manual: mover ambos manteniendo duración
      const dur = (new Date(fin).getTime() - new Date(inicio).getTime()) / (1000*60*60*24);
      base.setDate(base.getDate() + delta * (dur + 1));
    }
    const { ini, fin: f2 } = calcularRango(base, tipoVista);
    setInicio(ini); setFin(f2);
    aplicarFiltros({ fechaInicio: ini, fechaFin: f2 });
    recargarDatos();
  }

  function aplicarManual() {
    aplicarFiltros({ fechaInicio: inicio, fechaFin: fin, tipoVista });
    recargarDatos();
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow-md p-4 md:p-5 border border-gray-300 flex flex-col md:flex-row md:items-end gap-4">
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label className="text-xs text-gray-700 font-medium">Vista</label>
        <select value={tipoVista} onChange={e=>onChangeTipoVista(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500">
          <option value="diario">Diario</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
          <option value="rango">Rango Manual</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-700 font-medium">Desde</label>
        <input disabled={tipoVista!=='rango'} type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-700 font-medium">Hasta</label>
        <input disabled={tipoVista!=='rango'} type="date" value={fin} onChange={e=>setFin(e.target.value)} className="border rounded-md px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
      </div>
      <div className="flex gap-2 items-center mt-2 md:mt-0">
        <button onClick={()=>moverPeriodo(-1)} className="px-2 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-100 focus:ring-2 focus:ring-blue-500">◀</button>
        <button onClick={()=>moverPeriodo(1)} className="px-2 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-100 focus:ring-2 focus:ring-blue-500">▶</button>
      </div>
      {tipoVista==='rango' && (
        <button onClick={aplicarManual} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm shadow-md focus:ring-2 focus:ring-blue-500">Aplicar</button>
      )}
    </div>
  );
};
export default FiltroDashboard;
