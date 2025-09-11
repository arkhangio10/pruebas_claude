"use client";
import React, { useEffect } from 'react';
import { useDashboard } from '@/context/DashboardContext';

export const KpisDashboard: React.FC = () => {
  const { datos, recargarDatos, loading, error } = useDashboard();
  useEffect(() => { recargarDatos(); }, [recargarDatos]);
  const k = datos?.kpis;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {['valorTotal','costoTotal','ganancia','productividadPromedio','totalHoras'].map(key => (
        <div key={key} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="text-xs uppercase tracking-wide text-gray-500">{key}</div>
          <div className="text-xl font-semibold">{loading? '...' : (k?.[key] ?? 0).toLocaleString('es-PE')}</div>
        </div>
      ))}
      {error && <div className="col-span-full text-red-600 text-sm">{error}</div>}
    </div>
  );
};
