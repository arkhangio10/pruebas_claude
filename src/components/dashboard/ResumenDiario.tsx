"use client";
import React from 'react';
import { useDashboard } from '@/context/DashboardContext';

const ResumenDiario: React.FC = () => {
  const { datos, filtros, loading } = useDashboard();
  const totalActs = datos?.reportes.reduce((acc,r)=> acc + (r.actividades?.length||0),0) || 0;
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-2">
      <h3 className="font-semibold text-lg">Resumen Diario</h3>
      <div className="text-sm text-gray-600">Rango: {filtros.fechaInicio} - {filtros.fechaFin}</div>
      {loading ? <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/> : (
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Reportes: {datos?.reportes.length || 0}</li>
          <li>Actividades: {totalActs}</li>
          <li>Trabajadores (estim): {datos?.trabajadores.length || 0}</li>
        </ul>
      )}
    </div>
  );
};
export default ResumenDiario;
