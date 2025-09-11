"use client";
import React, { useMemo } from 'react';
import { useDashboard } from '@/context/DashboardContext';

const AnalisisProductividad: React.FC = () => {
  const { datos } = useDashboard();
  const top = useMemo(()=>{
    const arr: any[] = [];
    (datos?.reportes||[]).forEach(r=> (r.actividades||[]).forEach((a:any)=>{
      const prod = (a.metradoP? (a.metradoE||0)/(a.metradoP||1):0);
      arr.push({ nombre:a.nombre, productividad: prod });
    }));
    return arr.sort((a,b)=> b.productividad - a.productividad).slice(0,10);
  },[datos]);
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h3 className="font-semibold mb-4">Top Productividad Actividades</h3>
      <ul className="text-sm space-y-1">
        {top.map(t => <li key={t.nombre} className="flex justify-between"><span>{t.nombre}</span><span className="font-mono">{(t.productividad*100).toFixed(1)}%</span></li>)}
      </ul>
    </div>
  );
};
export default AnalisisProductividad;
