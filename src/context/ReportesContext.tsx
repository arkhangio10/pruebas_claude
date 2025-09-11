"use client";
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface Reporte {
  id: string;
  elaboradoPor: string;
  fecha: string;
  bloque: string;
  estado: string;
  revisadoPor?: string;
  spreadsheetUrl?: string;
  enlaceCarpeta?: string;
  enlaceDrive?: string;
  error?: string;
  subcontratistaBloque?: string;
  fechaProcesamiento?: string;
  valorizado?: number;
  trabajadores?: number;
  actividades?: number;
}

interface FiltrosReportes {
  fechaInicio: string; // formato YYYY-MM-DD
  fechaFin: string;    // formato YYYY-MM-DD
  estado: string;      // 'TODOS', 'PROCESADO', 'PENDIENTE', 'ERROR', etc.
  subcontratista: string; // 'TODOS' o el nombre específico
}

interface ReportesContextValue {
  loading: boolean;
  error: string | null;
  reportes: Reporte[];
  filtros: FiltrosReportes;
  listaSubcontratistas: string[];
  aplicarFiltros: (f: Partial<FiltrosReportes>) => void;
  recargarDatos: () => Promise<void>;
}

const ReportesContext = createContext<ReportesContextValue | undefined>(undefined);

// Configuración de caché consistente con otros módulos
const TTL_MS = 3 * 60 * 60 * 1000; // 3h
const CACHE_VERSION = 'r1';
const getCacheKey = (f: FiltrosReportes) => {
  const hourKey = Math.floor(Date.now() / (1000 * 60 * 60));
  return `reportes:${CACHE_VERSION}:${f.fechaInicio}:${f.fechaFin}:${f.estado}:${f.subcontratista}:${hourKey}`;
};

export const ReportesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  
  // Inicializar filtros con el mes actual
  const [filtros, setFiltros] = useState<FiltrosReportes>(() => {
    // Inicializar con agosto 2025 para mostrar los datos de prueba
    // Las fechas en la colección Reportes_Links están en formato YYYY-MM-DD
    
    // Configuramos para mostrar todos los reportes disponibles en agosto
    const hoy = new Date();
    let fechaInicio = "2025-08-01"; // Inicio de agosto
    let fechaFin = "2025-08-31";    // Fin de agosto
    
    console.log("Inicializando filtros para mostrar todos los reportes de agosto 2025");

    return {
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      estado: 'TODOS',
      subcontratista: 'TODOS'
    };
  });
  
  const aplicarFiltros = useCallback((f: Partial<FiltrosReportes>) => {
    setFiltros(prev => ({ ...prev, ...f }));
  }, []);
  
  // Estado para almacenar la lista de subcontratistas
  const [listaSubcontratistas, setListaSubcontratistas] = useState<string[]>([]);
  
  // Ref para evitar concurrencia
  const isFetchingRef = useRef(false);
  
  const recargarDatos = useCallback(async () => {
    if (isFetchingRef.current) return; // evitar duplicado
    isFetchingRef.current = true;
    setLoading(true); setError(null);
    try {
      if (!filtros.fechaInicio.match(/^\d{4}-\d{2}-\d{2}$/) || !filtros.fechaFin.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new Error('Formato de fecha inválido. Use YYYY-MM-DD.');
      }
      const ck = getCacheKey(filtros);
      let usedCache = false;
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(ck);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.exp > Date.now()) {
              setReportes(parsed.v);
              if (parsed.metaSubcontratistas) setListaSubcontratistas(parsed.metaSubcontratistas);
              usedCache = true;
            }
          } catch {}
        }
      }
      if (!usedCache) {
        const params = new URLSearchParams({
          fechaInicio: filtros.fechaInicio,
          fechaFin: filtros.fechaFin,
          estado: filtros.estado,
          subcontratista: filtros.subcontratista,
          ts: Date.now().toString()
        });
        const url = `/api/reportes?${params.toString()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setReportes(data.reportes || []);
        if (data.metadata?.subcontratistas) setListaSubcontratistas(data.metadata.subcontratistas);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ck, JSON.stringify({ v: data.reportes || [], metaSubcontratistas: data.metadata?.subcontratistas || [], exp: Date.now() + TTL_MS }));
        }
      }
    } catch(e:any){
      console.error('[Reportes] Error:', e);
      setError(e.message || 'Error al cargar datos');
      if (!isFetchingRef.current) setReportes([]);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [filtros]);
  
  // Referencia para llevar un contador de llamadas y evitar condiciones de carrera
  const requestIdRef = React.useRef(0);
  
  // Debounce de recarga por cambio de filtros
  useEffect(()=>{
    const id = ++requestIdRef.current;
    const t = setTimeout(() => { if (id === requestIdRef.current) recargarDatos(); }, 250);
    return ()=> clearTimeout(t);
  }, [filtros, recargarDatos]);
  
  const value = useMemo(() => ({
    loading,
    error,
    reportes,
    filtros,
    listaSubcontratistas,
    aplicarFiltros,
    recargarDatos
  }), [loading, error, reportes, filtros, listaSubcontratistas, aplicarFiltros, recargarDatos]);
  
  return (
    <ReportesContext.Provider value={value}>
      {children}
    </ReportesContext.Provider>
  );
};

export const useReportes = () => {
  const context = useContext(ReportesContext);
  if (context === undefined) {
    throw new Error('useReportes debe ser usado dentro de un ReportesProvider');
  }
  return context;
};
