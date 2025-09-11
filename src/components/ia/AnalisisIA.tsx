"use client";
import React, { useState } from 'react';
import { useIA, IAAnalysisType, IAQuery } from '@/context/IAContext';
import { useDashboard } from '@/context/DashboardContext';

export const AnalisisIA: React.FC = () => {
  const { datos, filtros } = useDashboard();
  const { loading, analytics, consultarIA } = useIA();
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<IAAnalysisType>('general');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCustom, setShowCustom] = useState(false);

  async function handleAnalyze() {
    // Limpiar errores previos
    setError(null);
    
    const query: IAQuery = {
      tipo: selectedType,
      prompt: showCustom ? customPrompt : undefined,
      detalle: true
    };
    
    try {
      console.log(`Iniciando análisis de tipo: ${selectedType}`);
      await consultarIA(query);
      console.log('Análisis completado con éxito');
    } catch (e: any) {
      console.error("Error al consultar IA:", e);
      setError(`Error al consultar IA: ${e.message || 'Error desconocido'}`);
    }
  }
  
  // Añadir función para limpiar error
  function limpiarError() {
    setError(null);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Análisis de Inteligencia Artificial</h3>
        <div className="text-sm text-gray-500">
          Datos: {filtros.fechaInicio} a {filtros.fechaFin}
        </div>
      </div>
      
      {/* Selector de tipo de análisis */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setSelectedType('general')}
            className={`px-4 py-2 rounded-md ${selectedType === 'general' 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            General
          </button>
          <button 
            onClick={() => setSelectedType('costos')}
            className={`px-4 py-2 rounded-md ${selectedType === 'costos' 
              ? 'bg-orange-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Costos
          </button>
          <button 
            onClick={() => setSelectedType('productividad')}
            className={`px-4 py-2 rounded-md ${selectedType === 'productividad' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Productividad
          </button>
          <button 
            onClick={() => setSelectedType('tendencias')}
            className={`px-4 py-2 rounded-md ${selectedType === 'tendencias' 
              ? 'bg-amber-700 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Tendencias
          </button>
          <button 
            onClick={() => setSelectedType('recomendaciones')}
            className={`px-4 py-2 rounded-md ${selectedType === 'recomendaciones' 
              ? 'bg-pink-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            Recomendaciones
          </button>
          <button 
            onClick={() => {
              setSelectedType('personalizado');
              setShowCustom(true);
            }}
            className={`px-4 py-2 rounded-md ${selectedType === 'personalizado' 
              ? 'bg-purple-600 text-white' 
              : 'bg-purple-100 hover:bg-purple-200'}`}
          >
            Personalizado
          </button>
        </div>
        
        {/* Prompt personalizado */}
        {showCustom && (
          <div className="space-y-2">
            <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700">
              Prompt personalizado:
            </label>
            <textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full rounded-md border border-purple-300 shadow-sm p-2 min-h-[100px] bg-purple-50"
              placeholder="Escribe tu pregunta o instrucción específica para analizar los datos..."
            />
          </div>
        )}
        
        <button 
          onClick={handleAnalyze} 
          disabled={loading || !datos} 
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md"
        >
          {loading ? 'Analizando...' : 'Analizar Datos'}
        </button>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <button 
              onClick={limpiarError}
              className="text-red-500 hover:text-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Spinner de carga */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
      
      {/* Resultados */}
      {analytics && !loading && (
        <div className="space-y-6">
          {/* Información sobre la fuente de datos */}
          {analytics.rawData && analytics.rawData.bigQueryData && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-blue-700">
                {analytics.rawData.usandoRespuestaSimulada 
                  ? "Análisis basado en datos locales (BigQuery no disponible)" 
                  : "Análisis basado en datos reales de BigQuery"}
              </span>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-lg mb-2">Insights</h4>
            <ul className="list-disc pl-5 space-y-1">
              {analytics.insights.map((insight, index) => (
                <li key={index} className="text-gray-700">{insight}</li>
              ))}
            </ul>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-lg mb-2">Recomendaciones</h4>
            <ul className="list-disc pl-5 space-y-1">
              {analytics.recommendations.map((rec, index) => (
                <li key={index} className="text-gray-700">{rec}</li>
              ))}
            </ul>
          </div>
          
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-lg mb-2">Tendencias</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(analytics.trends).map(([key, value]) => (
                <div key={key} className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-500 text-sm capitalize">{key}</span>
                  <p className="font-medium capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-right text-xs text-gray-400">
            Actualizado: {new Date(analytics.timestamp).toLocaleString()}
            {analytics.rawData && (
              <>
                {" • "}
                Reportes: {analytics.rawData.kpisCount || 0}
                {" • "}
                Actividades: {analytics.rawData.actividadesCount || 0}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
