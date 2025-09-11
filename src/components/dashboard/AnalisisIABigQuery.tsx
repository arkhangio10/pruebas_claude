"use client";
import React, { useState } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { analizarDatosConstruccion } from '@/services/geminiClient';

export const AnalisisIABigQuery: React.FC = () => {
  const { datos } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [texto, setTexto] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!datos) return;
    setLoading(true); setError(null);
    try {
      const res = await analizarDatosConstruccion({ kpis: datos.kpis, actividades: datos.actividades }, { mode: 'mock' });
      setTexto(res.texto || JSON.stringify(res));
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Análisis IA (BigQuery)</h3>
        <button onClick={run} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md">
          {loading ? 'Analizando...' : 'Generar'}
        </button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading && <div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full" />}
      {texto && <pre className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700">{texto}</pre>}
    </div>
  );
};
