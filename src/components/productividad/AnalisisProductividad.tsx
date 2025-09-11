"use client";
import React from 'react';
import { useProductividad } from '@/context/ProductividadContext';

const AnalisisProductividad: React.FC = () => {
  const { datos, loading, error } = useProductividad();

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
      Error: {error}
    </div>
  );

  if (!datos || !datos.actividades.length) return (
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
      No hay datos disponibles para el periodo seleccionado.
    </div>
  );

  // Obtener totales para los KPIs
  const totalHoras = datos.kpis.totalHoras || 0;
  const totalHorasOperario = datos.kpis.totalHorasOperario || 0;
  const totalHorasOficial = datos.kpis.totalHorasOficial || 0;
  const totalHorasPeon = datos.kpis.totalHorasPeon || 0;
  const productividadPromedio = datos.kpis.productividadPromedio || 0;
  const avanceTotal = datos.kpis.avancePromedio || 0; // Suma total del avance (metrado) - el nombre del campo es avancePromedio por motivos históricos

  // Función auxiliar para formatear números
  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  return (
    <div className="space-y-6">
      {/* KPIs de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Total Horas</h3>
          <p className="text-2xl font-bold text-blue-700">{formatNumber(totalHoras)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Horas Operario</h3>
          <p className="text-2xl font-bold text-green-700">{formatNumber(totalHorasOperario)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Horas Oficial</h3>
          <p className="text-2xl font-bold text-yellow-700">{formatNumber(totalHorasOficial)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Horas Peón</h3>
          <p className="text-2xl font-bold text-red-700">{formatNumber(totalHorasPeon)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avance Total</h3>
          <p className="text-2xl font-bold text-purple-700">{formatNumber(avanceTotal)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 mt-4 lg:mt-0">
          <h3 className="text-sm font-medium text-gray-500">Productividad Promedio</h3>
          <p className="text-2xl font-bold text-indigo-700">{formatNumber(productividadPromedio)}</p>
        </div>
      </div>

      {/* Tabla de actividades */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividad
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avance (Metrado)
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horas
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productividad
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  H. Operario
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  H. Oficial
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  H. Peón
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {datos.actividades.map((actividad) => (
                <tr key={actividad.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {actividad.nombre}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right text-gray-900">
                    {actividad.metrado ? `${formatNumber(actividad.metrado)} ${actividad.unidadMedida || ''}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(actividad.horas || 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(actividad.productividad || 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(actividad.horasOperario || 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(actividad.horasOficial || 0)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatNumber(actividad.horasPeon || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-orange-50">
              <tr>
                <th scope="row" className="px-3 py-3.5 text-left text-sm font-medium text-gray-900 bg-orange-100">
                  Total
                </th>
                <td className="px-3 py-3.5 text-sm text-right font-medium text-gray-900 bg-orange-100 font-bold">
                  {formatNumber(avanceTotal)}
                </td>
                <td className="px-3 py-3.5 text-sm text-right font-medium text-gray-900 bg-orange-100">
                  {formatNumber(totalHoras)}
                </td>
                <td className="px-3 py-3.5 text-sm text-right font-medium text-gray-900 bg-orange-100">
                  {formatNumber(productividadPromedio)}
                </td>
                <td className="px-3 py-3.5 text-sm text-right font-medium text-gray-900 bg-orange-100">
                  {formatNumber(totalHorasOperario)}
                </td>
                <td className="px-3 py-3.5 text-sm text-right font-medium text-gray-900 bg-orange-100">
                  {formatNumber(totalHorasOficial)}
                </td>
                <td className="px-3 py-3.5 text-sm text-right font-medium text-gray-900 bg-orange-100">
                  {formatNumber(totalHorasPeon)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalisisProductividad;
