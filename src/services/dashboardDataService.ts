import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getBigQueryAIAnalytics } from './bigQueryClient';
import { computeKpis } from '@/utils/kpis';
import { DashboardData, FiltrosDashboard } from '@/utils/types';

// ------------------------------------------------------------
// Utilidades internas para fechas
// ------------------------------------------------------------
function listDatesInclusive(start: string, end: string): string[] {
  const res: string[] = [];
  const dStart = new Date(start + 'T00:00:00');
  const dEnd = new Date(end + 'T00:00:00');
  for (let d = dStart; d <= dEnd; d.setDate(d.getDate() + 1)) {
    res.push(d.toISOString().slice(0, 10));
  }
  return res;
}

function weekISO(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7; // lunes=0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ------------------------------------------------------------
// Lectura de colecciones resumen en Firestore (nuevo modo costos)
// ------------------------------------------------------------
async function getResumenFirebase(filtros: FiltrosDashboard): Promise<DashboardData> {
  const params = new URLSearchParams({
    fechaInicio: filtros.fechaInicio,
    fechaFin: filtros.fechaFin,
    tipoVista: filtros.tipoVista || 'diario',
    v: '2',
    debug: '1',
    raw: '1'
  });
  const res = await fetch(`/api/resumen?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API resumen error ${res.status}: ${txt.substring(0,200)}`);
  }
  const json = await res.json();
  if (typeof window !== 'undefined') {
    // Debug sólo en cliente
    console.debug('[ResumenAPI] actividades:', json.actividades?.length, 'kpis:', json.kpis, 'debugMeta:', json.debug);
  }
  // Enriquecer actividades con costoExpediente simple (placeholder) si no viene
  const acts = (json.actividades || []).map((a: any) => ({
    ...a,
    costoExpediente: a.costoExpediente ?? (a.total ? a.total * 0.1 : 0)
  }));
  return { kpis: json.kpis || {}, reportes: [], actividades: acts, trabajadores: [] };
}

const CACHE_VERSION = '1.0';

export async function getKpisAndReportes(
  filtros: FiltrosDashboard
): Promise<DashboardData> {
  const cacheKey = `dashboard:${CACHE_VERSION}:${filtros.tipoVista}:${filtros.fechaInicio}:${filtros.fechaFin}:${filtros.modoDatos}`;

  // Por ahora, usar siempre Firebase hasta que se corrija el endpoint de BigQuery
  return await getResumenFirebase(filtros);
}
