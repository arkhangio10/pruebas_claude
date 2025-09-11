"use client";
import React from 'react';
import { useReportes } from '@/context/ReportesContext';
import FiltroReportes from './FiltroReportes';
import { useRouter } from 'next/navigation';
import ReporteDetalleModal, { ReporteDetalleData } from './ReporteDetalleModal';

const TablaReportes: React.FC = () => {
  const router = useRouter();
  const { reportes, loading, error, recargarDatos } = useReportes();

  const [openDetalle, setOpenDetalle] = React.useState(false);
  const [detalleLoading, setDetalleLoading] = React.useState(false);
  const [detalle, setDetalle] = React.useState<{ reporte: ReporteDetalleData; actividades: any[]; manoObra: any[] } | null>(null);

  const abrirDetalle = async (id: string) => {
    setDetalleLoading(true);
    try {
      const res = await fetch(`/api/reportes/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Detalle HTTP ${res.status}`);
      const json = await res.json();
      setDetalle({ reporte: json.reporte, actividades: json.detalles?.actividades || [], manoObra: json.detalles?.manoObra || [] });
      setOpenDetalle(true);
    } catch (e) {
      console.error('[Detalle reporte] Error:', e);
      alert('No se pudo obtener el detalle del reporte.');
    } finally {
      setDetalleLoading(false);
    }
  };

  const reprocesarDesdeModal = async (id: string) => {
    // Placeholder: aquí se integraría una API de reproceso real
    alert(`Reprocesar reporte ${id} (pendiente de implementar)`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <FiltroReportes />
        <div className="flex flex-col justify-center items-center h-64 bg-white rounded-lg shadow p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <FiltroReportes />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-md flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-medium">Error al cargar los reportes</p>
            <p className="mt-1">{error}</p>
            <button 
              onClick={recargarDatos}
              className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-sm"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!reportes || reportes.length === 0) {
    return (
      <div className="space-y-4">
        <FiltroReportes />
        <div className="bg-white border border-gray-200 text-gray-700 px-6 py-8 rounded-md shadow-sm flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-yellow-400 mb-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-lg font-medium mb-2">No hay reportes disponibles</p>
          <p className="text-gray-500 text-center mb-4">No se encontraron reportes para el período y los filtros seleccionados.</p>
          <button 
            onClick={() => window.open('/dashboard/reportes/nuevo', '_blank')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear Nuevo Reporte
          </button>
        </div>
      </div>
    );
  }

  // Función para formatear valores negativos en rojo
  const formatValorizado = (valor: number | undefined) => {
    if (!valor && valor !== 0) return '-';
    
    const formattedValue = `S/ ${Math.abs(valor).toLocaleString('es-PE', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
    
    if (valor < 0) {
      return <span className="text-red-600">-{formattedValue}</span>;
    }
    return formattedValue;
  };

  const getEstadoClasses = (estado: string) => {
    switch(estado) {
      case 'PROCESADO':
        return 'bg-green-100 text-green-800 border border-green-300';
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
      case 'ERROR':
        return 'bg-red-100 text-red-800 border border-red-300';
      case 'ERROR_CRITICO':
        return 'bg-red-500 text-white border border-red-600';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-300';
    }
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '-';
    
    // Si es una fecha ISO, convertir a formato DD/MM/YYYY
    if (fecha.includes('T')) {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
    
    // Si ya es una fecha YYYY-MM-DD, convertir a DD/MM/YYYY
    const parts = fecha.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    return fecha;
  };

  return (
    <div className="space-y-4">
      <FiltroReportes />
      
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Reportes ({reportes.length})</h3>
        <button 
          onClick={() => window.open('/dashboard/reportes/nuevo', '_blank')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Reporte
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creado Por
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bloque
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trabajadores
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actividades
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valorizado
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportes.map((reporte) => (
                <tr key={reporte.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {reporte.elaboradoPor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatFecha(reporte.fecha)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {reporte.bloque}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {reporte.trabajadores || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                    {reporte.actividades || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatValorizado(reporte.valorizado)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => abrirDetalle(reporte.id)}
                        className="text-indigo-600 hover:text-indigo-800 p-1 bg-indigo-50 rounded-md border border-indigo-200"
                        title="Ver reporte"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
                        </svg>
                      </button>
                      {reporte.spreadsheetUrl && (
                        <a 
                          href={reporte.spreadsheetUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded-md border border-green-200"
                          title="Ver en Google Sheets"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </a>
                      )}
                      
                      {reporte.enlaceCarpeta && (
                        <a 
                          href={reporte.enlaceCarpeta} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-yellow-600 hover:text-yellow-800 p-1 bg-yellow-50 rounded-md border border-yellow-200"
                          title="Ver carpeta en Drive"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </a>
                      )}
                      
                      <button
                        onClick={() => {
                          alert(`Estado: ${reporte.estado}\n${reporte.error || 'No hay detalles adicionales'}`);
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium ${getEstadoClasses(reporte.estado)}`}
                        title={reporte.error || reporte.estado}
                      >
                        {reporte.estado === 'ERROR_CRITICO' ? 'ERROR' : reporte.estado}
                      </button>
                      
                      {/* El reprocesar se movió al modal */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-orange-100 border-t-2 border-orange-600">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  TOTALES
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900"></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900"></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center text-gray-900">
                  {reportes.reduce((sum, r) => sum + (r.trabajadores || 0), 0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-center text-gray-900">
                  {reportes.reduce((sum, r) => sum + (r.actividades || 0), 0)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900">
                  {formatValorizado(reportes.reduce((sum, r) => sum + (r.valorizado || 0), 0))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <ReporteDetalleModal
        open={openDetalle}
        onClose={() => setOpenDetalle(false)}
        reporte={detalle?.reporte}
        actividades={detalle?.actividades}
        manoObra={detalle?.manoObra}
        onReprocesar={reprocesarDesdeModal}
      />
    </div>
  );
};

export default TablaReportes;
