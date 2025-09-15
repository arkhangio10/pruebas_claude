import React, { useState } from 'react';

// Definición de interfaces para tipado
interface Metadata {
  periodo?: string;
  registrosAnalizados?: number;
  fuenteDatos?: string;
}

interface Insights {
  productivityTrend?: 'aumentando' | 'disminuyendo' | 'estable';
  costTrend?: 'aumentando' | 'disminuyendo' | 'estable';
  mainPoints?: string[];
  recommendations?: string[];
}

interface ResultadoAnalisis {
  metadata?: Metadata;
  dataTimestamp?: string;
  insights?: Insights;
  text?: string;
}

const AnalisisIABigQuery = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAnalisis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipoAnalisis, setTipoAnalisis] = useState('general');
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return inicio.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [promptPersonalizado, setPromptPersonalizado] = useState('');
  const [mostrarPromptPersonalizado, setMostrarPromptPersonalizado] = useState(false);
  // Nuevo estado para controlar la expansión del texto
  const [mostrarTextoCompleto, setMostrarTextoCompleto] = useState(false);

  const ejecutarAnalisis = async () => {
    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      const payload = {
        filters: {
          inicio: fechaInicio,
          fin: fechaFin
        },
        tipoAnalisis: tipoAnalisis,
        ...(tipoAnalisis === 'personalizado' && promptPersonalizado 
          ? { promptPersonalizado } 
          : {})
      };

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en el análisis');
      }

      const data = await response.json();
      setResultado(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const tiposAnalisis = [
    { valor: 'general', nombre: '📊 Análisis General', color: 'bg-blue-500' },
    { valor: 'costos', nombre: '💰 Análisis de Costos', color: 'bg-green-500' },
    { valor: 'productividad', nombre: '⚡ Análisis de Productividad', color: 'bg-yellow-500' },
    { valor: 'tendencias', nombre: '📈 Análisis de Tendencias', color: 'bg-purple-500' },
    { valor: 'recomendaciones', nombre: '💡 Recomendaciones', color: 'bg-orange-500' },
    { valor: 'personalizado', nombre: '✨ Análisis Personalizado', color: 'bg-pink-500' }
  ];

  const formatearNumero = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('es-PE').format(num);
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold mb-2">🤖 Análisis Inteligente con IA</h1>
        <p className="text-blue-100">
          Análisis avanzado de datos de construcción usando Google Gemini y BigQuery
        </p>
      </div>

      {/* Controles */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Análisis
            </label>
            <select
              value={tipoAnalisis}
              onChange={(e) => {
                setTipoAnalisis(e.target.value);
                setMostrarPromptPersonalizado(e.target.value === 'personalizado');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {tiposAnalisis.map(tipo => (
                <option key={tipo.valor} value={tipo.valor}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prompt Personalizado */}
        {mostrarPromptPersonalizado && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt Personalizado
            </label>
            <textarea
              value={promptPersonalizado}
              onChange={(e) => setPromptPersonalizado(e.target.value)}
              placeholder="Escribe tu consulta específica sobre los datos del proyecto..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md h-32 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Botón de Análisis */}
        <div className="flex justify-center mt-6">
          <button
            onClick={ejecutarAnalisis}
            disabled={loading}
            className={`px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 transform hover:scale-105 ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg'
            }`}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analizando con IA...
              </span>
            ) : (
              '🚀 Ejecutar Análisis IA'
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {resultado && (
        <div className="space-y-6">
          {/* Metadatos */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Período:</span>
                <p className="font-semibold">{resultado.metadata?.periodo || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Registros Analizados:</span>
                <p className="font-semibold">{formatearNumero(resultado.metadata?.registrosAnalizados)}</p>
              </div>
              <div>
                <span className="text-gray-500">Fuente:</span>
                <p className="font-semibold">{resultado.metadata?.fuenteDatos || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Timestamp:</span>
                <p className="font-semibold">
                  {resultado.dataTimestamp ? new Date(resultado.dataTimestamp).toLocaleString('es-PE') : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Tendencias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${
              resultado.insights?.productivityTrend === 'aumentando' ? 'bg-green-50 border-green-200' :
              resultado.insights?.productivityTrend === 'disminuyendo' ? 'bg-red-50 border-red-200' :
              'bg-gray-50 border-gray-200'
            } border`}>
              <h3 className="font-semibold text-lg mb-2">📊 Tendencia de Productividad</h3>
              <p className={`text-2xl font-bold ${
                resultado.insights?.productivityTrend === 'aumentando' ? 'text-green-600' :
                resultado.insights?.productivityTrend === 'disminuyendo' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {resultado.insights?.productivityTrend === 'aumentando' ? '↗️ Mejorando' :
                 resultado.insights?.productivityTrend === 'disminuyendo' ? '↘️ Disminuyendo' :
                 '→ Estable'}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${
              resultado.insights?.costTrend === 'aumentando' ? 'bg-red-50 border-red-200' :
              resultado.insights?.costTrend === 'disminuyendo' ? 'bg-green-50 border-green-200' :
              'bg-gray-50 border-gray-200'
            } border`}>
              <h3 className="font-semibold text-lg mb-2">💰 Tendencia de Costos</h3>
              <p className={`text-2xl font-bold ${
                resultado.insights?.costTrend === 'aumentando' ? 'text-red-600' :
                resultado.insights?.costTrend === 'disminuyendo' ? 'text-green-600' :
                'text-gray-600'
              }`}>
                {resultado.insights?.costTrend === 'aumentando' ? '↗️ Aumentando' :
                 resultado.insights?.costTrend === 'disminuyendo' ? '↘️ Reduciendo' :
                 '→ Estable'}
              </p>
            </div>
          </div>

          {/* Hallazgos Principales */}
          {resultado.insights?.mainPoints && resultado.insights.mainPoints.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4 text-blue-800">🔍 Hallazgos Principales</h3>
              <ul className="space-y-3">
                {resultado.insights.mainPoints.map((point, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm mr-3">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recomendaciones */}
          {resultado.insights?.recommendations && resultado.insights.recommendations.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4 text-green-800">💡 Recomendaciones</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultado.insights.recommendations.map((rec, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex items-start">
                      <span className="flex-shrink-0 text-2xl mr-3">
                        {index === 0 ? '🎯' : index === 1 ? '⚡' : index === 2 ? '📈' : index === 3 ? '👥' : '✅'}
                      </span>
                      <p className="text-sm text-gray-700">{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Análisis Completo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">📝 Análisis Completo</h3>
              <button
                onClick={() => setMostrarTextoCompleto(!mostrarTextoCompleto)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Ver {mostrarTextoCompleto ? 'menos' : 'más'}
              </button>
            </div>
            <div 
              className={`prose max-w-none text-gray-700 overflow-y-auto whitespace-pre-wrap ${
                !mostrarTextoCompleto ? 'max-h-96' : ''
              }`}
            >
              {resultado.text || 'No hay análisis disponible'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisIABigQuery;