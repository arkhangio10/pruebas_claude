"use client";
import React, { useState } from 'react';
import { useIA } from '@/context/IAContext';

// Iconos simulados con caracteres
const IconTendencias = {
  aumentando: '',
  disminuyendo: '',
  estable: '',
  cr�tico: '',
  mejorando: '',
  default: '',
};

const IAResultado: React.FC = () => {
  const { loading, analytics, error, fullText } = useIA();
  const [activeTab, setActiveTab] = useState<'hallazgos' | 'recomendaciones' | 'completo'>('hallazgos');
  const [showFullText, setShowFullText] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-md">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-gray-50 p-4 rounded-md text-center">
        <p className="text-gray-500">
          No hay an�lisis disponible. Utiliza las opciones anteriores para generar un an�lisis de IA.
        </p>
      </div>
    );
  }

  const getTrendIcon = (trend: string) => {
    return IconTendencias[trend as keyof typeof IconTendencias] || IconTendencias.default;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Resultado del An�lisis</h3>
          <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
            Actualizado: {new Date(analytics.timestamp).toLocaleString()}
          </span>
        </div>

        <hr className="mb-4" />

        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex items-center p-2 border border-gray-200 rounded-md">
            <span className="mr-2">Productividad:</span>
            <span className="mr-1">{getTrendIcon(analytics.trends.productividad)}</span>
            <span className="capitalize">{analytics.trends.productividad}</span>
          </div>

          <div className="flex items-center p-2 border border-gray-200 rounded-md">
            <span className="mr-2">Costos:</span>
            <span className="mr-1">{getTrendIcon(analytics.trends.costos)}</span>
            <span className="capitalize">{analytics.trends.costos}</span>
          </div>
        </div>

        {/* Tabs de navegaci�n */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex space-x-4">
            <button
              className={`py-2 px-4 border-b-2 ${
                activeTab === 'hallazgos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('hallazgos')}
            >
               Hallazgos
            </button>
            <button
              className={`py-2 px-4 border-b-2 ${
                activeTab === 'recomendaciones'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('recomendaciones')}
            >
               Recomendaciones
            </button>
            <button
              className={`py-2 px-4 border-b-2 ${
                activeTab === 'completo'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('completo')}
            >
               Texto Completo
            </button>
          </div>
        </div>

        {/* Contenido de las pesta�as */}
        <div className="p-4">
          {activeTab === 'hallazgos' && (
            <div>
              {analytics.insights.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {analytics.insights.map((insight, index) => (
                    <li key={index} className="text-gray-800">{insight}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No se encontraron hallazgos clave en el an�lisis.</p>
              )}
            </div>
          )}

          {activeTab === 'recomendaciones' && (
            <div>
              {analytics.recommendations.length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {analytics.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-gray-800">{recommendation}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No se encontraron recomendaciones en el an�lisis.</p>
              )}
            </div>
          )}

          {activeTab === 'completo' && (
            <div>
              {fullText ? (
                <>
                  <div
                    className={`bg-gray-50 p-4 rounded-md whitespace-pre-wrap ${
                      !showFullText && 'max-h-96 overflow-auto'
                    }`}
                  >
                    {fullText}
                  </div>
                  {fullText.length > 1000 && (
                    <button
                      className="mt-2 text-blue-600 hover:text-blue-800"
                      onClick={() => setShowFullText(!showFullText)}
                    >
                      {showFullText ? 'Mostrar menos' : 'Mostrar texto completo'}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-gray-500">No hay texto completo disponible para este an�lisis.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IAResultado;
