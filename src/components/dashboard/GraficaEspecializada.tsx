"use client";
import React, { useMemo } from 'react';
import { useDashboard } from '@/context/DashboardContext';

// Placeholder simple; luego se puede reemplazar con Recharts
const GraficaEspecializada: React.FC = () => {
  const { datos } = useDashboard();
  const puntos = useMemo(()=>{
    return (datos?.reportes||[]).map((r:any,i:number)=> ({ x: i+1, y: (r.actividades||[]).length }));
  },[datos]);
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="font-semibold text-sm mb-2">Gráfica Especializada</h3>
      {puntos.length === 0 && <div className="text-xs text-gray-500">Sin datos para graficar</div>}
      {puntos.length>0 && (
        <div className="flex gap-1 items-end h-40">
          {puntos.map(p=> (
            <div key={p.x} className="bg-blue-600 w-3 rounded-sm" style={{ height: Math.max(4, p.y*8) }} title={`Reporte ${p.x}: ${p.y} actividades`}></div>
          ))}
        </div>
      )}
    </div>
  );
};
export default GraficaEspecializada;
