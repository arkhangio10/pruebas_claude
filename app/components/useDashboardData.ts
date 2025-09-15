'use client';
import { db, functions } from '@/lib/firebase';
import { collection, doc, documentId, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useMemo, useState } from 'react';

type ResumenDoc = {
  periodo?: string;
  fecha?: string;
  metricas?: Record<string, number>;
};

export function useResumenPeriodo(tipo: 'diario'|'semanal'|'mensual', inicio: string, fin: string) {
  const [resumen, setResumen] = useState<ResumenDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const docId = useMemo(() => `${tipo}_${inicio}`, [tipo, inicio]);

  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      try {
        if (inicio === fin) {
          const snap = await getDoc(doc(db, 'Dashboard_Resumenes', docId));
          if (!active) return;
          setResumen(snap.exists() ? (snap.data() as ResumenDoc) : null);
        } else {
          const q = query(
            collection(db, 'Dashboard_Resumenes'),
            where(documentId(), '>=', `${tipo}_${inicio}`),
            where(documentId(), '<=', `${tipo}_${fin}`),
            orderBy(documentId(), 'asc')
          );
          const snaps = await getDocs(q);
          const acc = snaps.docs.reduce((agg, d) => {
            const m = (d.data() as any).metricas || {};
            Object.keys(m).forEach(k => {
              const v = Number(m[k] || 0);
              agg[k] = (agg[k] || 0) + (Number.isFinite(v) ? v : 0);
            });
            return agg;
          }, {} as Record<string, number>);
          if (!active) return;
          setResumen({ periodo: tipo, fecha: `${inicio}..${fin}`, metricas: acc });
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    run();
    return () => { active = false; };
  }, [tipo, inicio, fin, docId]);

  return { resumen, loading };
}

export function useTopActividades(limit = 10) {
  const [actividades, setActividades] = useState<Array<any>>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const snaps = await getDocs(collection(db, 'Actividades_Resumen'));
      type ActividadResumen = { id: string; nombre?: string; unidad?: string; acumulado?: { valor?: number; horas?: number; metrado?: number } };
      const rows: ActividadResumen[] = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      rows.sort((a, b) => (b.acumulado?.valor ?? 0) - (a.acumulado?.valor ?? 0));
      if (!active) return;
      setActividades(rows.slice(0, limit));
    })();
    return () => { active = false; };
  }, [limit]);
  return { actividades };
}

export function useTopTrabajadores(limit = 10) {
  const [trabajadores, setTrabajadores] = useState<Array<any>>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const snaps = await getDocs(collection(db, 'Trabajadores_Resumen'));
      type TrabajadorResumen = { id: string; datos?: { nombre?: string; categoria?: string }; resumen?: { horas?: number; costoMO?: number } };
      const rows: TrabajadorResumen[] = snaps.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      rows.sort((a, b) => (b.resumen?.horas ?? 0) - (a.resumen?.horas ?? 0));
      if (!active) return;
      setTrabajadores(rows.slice(0, limit));
    })();
    return () => { active = false; };
  }, [limit]);
  return { trabajadores };
}

export function useMetricasPeriodoCallable(inicio: string, fin: string, tipo: 'diario'|'trabajadores'|'actividades') {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      try {
        const callable = httpsCallable(functions, 'obtenerMetricasPeriodo');
        const res = await callable({ fechaInicio: inicio, fechaFin: fin, tipo, fuente: 'auto' });
        if (!active) return;
        setData((res.data as any) || null);
      } finally {
        if (active) setLoading(false);
      }
    }
    if (inicio && fin) run();
    return () => { active = false; };
  }, [inicio, fin, tipo]);
  return { data, loading };
}

