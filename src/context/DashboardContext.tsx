"use client";
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { cacheGet, cacheSet } from '@/utils/cache';
import { getKpisAndReportes } from '@/services/dashboardDataService';

export interface DashboardData {
  kpis: Record<string, number>;
  reportes: any[];
  actividades: any[];
  trabajadores: any[];
}
export interface FiltrosDashboard {
  fechaInicio: string; // formato YYYY-MM-DD
  fechaFin: string;    // formato YYYY-MM-DD
  modoDatos: 'firebase' | 'bigquery';
  tipoVista?: 'diario' | 'semanal' | 'mensual' | 'rango';
}
interface DashboardContextValue {
  loading: boolean;
  error: string | null;
  datos: DashboardData | null;
  filtros: FiltrosDashboard;
  aplicarFiltros: (f: Partial<FiltrosDashboard>) => void;
  recargarDatos: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const TTL_MS = 24 * 60 * 60 * 1000;

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [filtros, setFiltros] = useState<FiltrosDashboard>(() => ({
    fechaInicio: new Date().toISOString().slice(0,10),
    fechaFin: new Date().toISOString().slice(0,10),
    modoDatos: 'bigquery', // Cambiamos a BigQuery por defecto
    tipoVista: 'diario'
  }));

  const aplicarFiltros = useCallback((f: Partial<FiltrosDashboard>) => {
    setFiltros(prev => ({ ...prev, ...f }));
  }, []);

  const CACHE_VERSION = 'v2'; // incrementar cuando cambie la forma de los datos
  const recargarDatos = useCallback(async () => {
    setLoading(true); setError(null);
    const cacheKey = `dashboard:${CACHE_VERSION}:${filtros.tipoVista}:${filtros.fechaInicio}:${filtros.fechaFin}:${filtros.modoDatos}`;
    const cached = cacheGet(cacheKey);
    if (cached) { setDatos(cached); setLoading(false); return; }
    try {
      const data = await getKpisAndReportes(filtros);
      setDatos(data);
      cacheSet(cacheKey, data, TTL_MS);
    } catch (e:any) {
      setError(e.message || 'Error cargando datos');
    } finally { setLoading(false); }
  }, [filtros]);

  const value = useMemo(() => ({ loading, error, datos, filtros, aplicarFiltros, recargarDatos }), [loading,error,datos,filtros,aplicarFiltros,recargarDatos]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard debe usarse dentro de DashboardProvider');
  return ctx;
}
