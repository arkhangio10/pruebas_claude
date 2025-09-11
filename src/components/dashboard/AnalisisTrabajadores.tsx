"use client";
import React, { useMemo } from 'react';
import { useDashboard } from '@/context/DashboardContext';

const AnalisisTrabajadores: React.FC = () => {
  const { datos } = useDashboard();
  const ranking = useMemo(()=>{
    const map: Record<string, number> = {};
    (datos?.reportes||[]).forEach(r => (r.actividades||[]).forEach((a:any)=> (a.trabajadores||[]).forEach((t:string)=>{ map[t] = (map[t]||0) + (a.metradoE||0); })));
    return Object.entries(map).map(([nombre,metrado])=>({ nombre, metrado })).sort((a,b)=> b.metrado - a.metrado).slice(0,10);
  },[datos]);
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h3 className="font-semibold mb-4">Ranking Trabajadores (Metrado Ejecutado)</h3>
      <ol className="list-decimal ml-5 space-y-1 text-sm">
        {ranking.map(r=> <li key={r.nombre} className="flex justify-between"><span>{r.nombre}</span><span className="font-mono">{r.metrado.toFixed(2)}</span></li>)}
      </ol>
    </div>
  );
};
export default AnalisisTrabajadores;
