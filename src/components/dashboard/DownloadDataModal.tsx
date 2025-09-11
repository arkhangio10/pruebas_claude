"use client";
import React, { useState } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { getKpisAndReportes } from '@/services/dashboardDataService';

interface Props { open: boolean; onClose: () => void; }

function buildCsv(reportes: any[]): string {
  const lines: string[] = [];
  lines.push('reporte_id,fecha,actividad,metradoP,metradoE,productividad,precioUnitario,trabajadores');
  reportes.forEach(r => {
    const rid = r.id || '';
    const fecha = r.fecha || '';
    (r.actividades || []).forEach((a: any) => {
      const prod = a.metradoP ? (a.metradoE || 0) / (a.metradoP || 1) : 0;
      const row = [
        rid,
        fecha,
        (a.nombre||'').replace(/,/g,' '),
        a.metradoP||0,
        a.metradoE||0,
        prod.toFixed(4),
        a.precioUnitario||0,
        (a.trabajadores||[]).join('|').replace(/,/g,';')
      ].join(',');
      lines.push(row);
    });
  });
  return lines.join('\n');
}

const todayStr = () => new Date().toISOString().slice(0,10);

export const DownloadDataModal: React.FC<Props> = ({ open, onClose }) => {
  const { filtros } = useDashboard();
  const [inicio, setInicio] = useState(filtros.fechaInicio);
  const [fin, setFin] = useState(filtros.fechaFin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);

  function resetState(){ setInicio(filtros.fechaInicio); setFin(filtros.fechaFin); setError(null); setSuccess(null); }

  async function handleDownload(){
    setLoading(true); setError(null); setSuccess(null);
    try {
      if (new Date(inicio) > new Date(fin)) throw new Error('Rango inválido');
      const data = await getKpisAndReportes({ ...filtros, fechaInicio: inicio, fechaFin: fin });
      const csv = buildCsv(data.reportes);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `hergonsa_reportes_${inicio}_a_${fin}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setSuccess('Archivo generado');
    } catch(e:any){ setError(e.message||'Error generando archivo'); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={()=>{ onClose(); resetState(); }} />
      <div className="relative bg-white w-full max-w-lg rounded-lg shadow-xl border border-gray-200 flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Descarga de Datos (CSV)</h2>
          <button onClick={()=>{ onClose(); resetState(); }} className="text-gray-500 hover:text-gray-700 text-sm">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-gray-500">Desde</label>
              <input type="date" max={todayStr()} value={inicio} onChange={e=>setInicio(e.target.value)} className="border rounded-md px-2 py-1" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-gray-500">Hasta</label>
              <input type="date" max={todayStr()} value={fin} onChange={e=>setFin(e.target.value)} className="border rounded-md px-2 py-1" />
            </div>
          </div>
          <p className="text-xs text-gray-500">El archivo incluirá reportes y actividades con métricas básicas. Formato CSV (UTF-8).</p>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-600">{success}</div>}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={()=>{ onClose(); resetState(); }} className="px-4 py-2 rounded-md border text-sm bg-white hover:bg-gray-50">Cancelar</button>
          <button onClick={handleDownload} disabled={loading} className="px-4 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />}
            {loading ? 'Generando...' : 'Generar CSV'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadDataModal;
