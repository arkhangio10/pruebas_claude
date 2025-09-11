"use client";
import React, { useEffect } from 'react';
import { useTrabajadores } from '@/context/TrabajadoresContext';
import FiltroTrabajadores from './FiltroTrabajadores';

const AnalisisTrabajadoresDetalle: React.FC = () => {
  const { trabajadores, loading, error, recargarDatos } = useTrabajadores();
  
  useEffect(() => {
    recargarDatos();
  }, [recargarDatos]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        Error: {error}
      </div>
    );
  }
  
  // Mostrar filtro incluso cuando no hay datos
  if (!trabajadores || trabajadores.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Análisis de Trabajadores</h2>
        </div>
        
        {/* Filtro de fechas - lo mostramos siempre */}
        <FiltroTrabajadores />
        
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
          No hay datos disponibles de trabajadores para el período seleccionado.
        </div>
      </div>
    );
  }
  
  // Función para formatear costos en soles
  const formatSoles = (amount: number) => {
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  // Función para formatear números decimales
  const formatNumber = (num: number) => {
    return num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Análisis de Trabajadores</h2>
      </div>
      
      {/* Filtro de fechas */}
      <FiltroTrabajadores />
      
      <div className="flex justify-end gap-2">
        <button 
          className="px-4 py-1 bg-green-50 text-green-700 border border-green-300 rounded hover:bg-green-100 transition-colors flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Descargar Excel
        </button>
      </div>
      
      {/* Eliminamos el encabezado redundante */}
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-medium">Trabajadores ({trabajadores.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trabajador
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoría
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horas
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metrado
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productividad ↓
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Eficiencia
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Costo MO
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trabajadores.map((trabajador) => (
                <tr key={trabajador.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {trabajador.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {trabajador.categoria}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(trabajador.horas)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(trabajador.metrado)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(trabajador.productividad)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {trabajador.eficiencia.toFixed(2)}x
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatSoles(trabajador.costoMO)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Fila de totales */}
            <tfoot className="bg-orange-100 border-t-2 border-orange-600">
              {trabajadores.length > 0 && (
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    TOTALES
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {/* Categorías no se suman */}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">
                    {formatNumber(trabajadores.reduce((sum, t) => sum + t.horas, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">
                    {formatNumber(trabajadores.reduce((sum, t) => sum + t.metrado, 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">
                    {/* Productividad promedio ponderada por horas */}
                    {formatNumber(
                      trabajadores.reduce((sum, t) => sum + t.productividad * t.horas, 0) / 
                      Math.max(1, trabajadores.reduce((sum, t) => sum + t.horas, 0))
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center text-gray-900">
                    {/* Eficiencia promedio */}
                    1.00x
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">
                    {formatSoles(trabajadores.reduce((sum, t) => sum + t.costoMO, 0))}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalisisTrabajadoresDetalle;
