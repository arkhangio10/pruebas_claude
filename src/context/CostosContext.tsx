"use client";
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

interface CostosFiltros {
  fechaInicio: string;
  fechaFin: string;
  tipoVista: 'diario' | 'semanal' | 'mensual' | 'rango';
}
interface CostosActividad {
  id: string;
  nombre: string;
  metrado?: number; horas?: number; total?: number;
  costoManoObra?: number; costoOperario?: number; costoOficial?: number; costoPeon?: number; costoExpediente?: number;
  fecha?: string; fechasDetalle?: string[];
}
interface CostosKpis { [k:string]: number; }
interface CostosData { actividades: CostosActividad[]; kpis: CostosKpis; }
interface CostosContextValue {
  loading: boolean; error: string|null; datos: CostosData | null;
  filtros: CostosFiltros; aplicarFiltros: (f: Partial<CostosFiltros>)=>void; recargarDatos: ()=>Promise<void>;
}

const CostosContext = createContext<CostosContextValue|undefined>(undefined);
const TTL_MS = 6 * 60 * 60 * 1000; // 6h específico costos
const CACHE_VERSION = 'c2';

async function fetchResumen(f: CostosFiltros): Promise<CostosData> {
  // Añadir un parámetro timestamp para evitar caché del navegador
  const timestamp = Date.now();
  const params = new URLSearchParams({ 
    fechaInicio: f.fechaInicio, 
    fechaFin: f.fechaFin, 
    tipoVista: f.tipoVista,
    // ✅ FIX: Configurar forceDaily correctamente para cada tipo de vista
    forceDaily: '0', // Permitir que todas las vistas usen agregados cuando sea apropiado
    ts: timestamp.toString() // Evitar caché HTTP
  });
  const res = await fetch(`/api/resumen?${params.toString()}` , { 
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  });
  if(!res.ok) throw new Error('Error API resumen');
  const json = await res.json();
  
  // ✅ FIX: Manejar errores del API (como fechas futuras)
  if (json.error) {
    throw new Error(json.error);
  }
  
  return { actividades: json.actividades||[], kpis: json.kpis||{} };
}

function cacheKey(f: CostosFiltros){
  // Incluir la hora actual redondeada a la hora más cercana para evitar caché persistente entre cambios de períodos
  const hourKey = Math.floor(Date.now() / (1000 * 60 * 60));
  return `costos:${CACHE_VERSION}:${f.tipoVista}:${f.fechaInicio}:${f.fechaFin}:${hourKey}`;
}

export const CostosProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const hoy = new Date().toISOString().slice(0,10);
  const [filtros, setFiltros] = useState<CostosFiltros>({ fechaInicio: hoy, fechaFin: hoy, tipoVista:'diario' });
  const [datos, setDatos] = useState<CostosData|null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError]=useState<string|null>(null);

  const aplicarFiltros = useCallback((f: Partial<CostosFiltros>) => {
    setFiltros(prev => ({ ...prev, ...f }));
  }, []);

  const recargarDatos = useCallback(async ()=>{
    setLoading(true); setError(null);
    try {
      const ck = cacheKey(filtros);
      const raw = typeof window!=='undefined'? localStorage.getItem(ck):null;
      if(raw){
        try{ const parsed = JSON.parse(raw); if(parsed.exp > Date.now()){ setDatos(parsed.v); setLoading(false); return; } }catch{}
      }
      const data = await fetchResumen(filtros);
      setDatos(data);
      if (typeof window !== 'undefined') localStorage.setItem(ck, JSON.stringify({ v:data, exp: Date.now()+TTL_MS }));
    } catch(e:any){ setError(e.message||'Error'); }
    finally { setLoading(false); }
  }, [filtros]);

  // Auto recarga cada vez que cambian los filtros para evitar usar filtros antiguos
  useEffect(()=>{ 
    // Limpiar cache específicamente relacionado con este periodo
    if (typeof window !== 'undefined') {
      // Borrar caché de vista actual al cambiar vista
      const vistaCacheKey = `costos:${CACHE_VERSION}:${filtros.tipoVista}:`;
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(vistaCacheKey)) localStorage.removeItem(k);
      });
    }
    recargarDatos(); 
  }, [filtros, recargarDatos]);

  const value = useMemo(()=>({ loading, error, datos, filtros, aplicarFiltros, recargarDatos }), [loading,error,datos,filtros,aplicarFiltros,recargarDatos]);
  return <CostosContext.Provider value={value}>{children}</CostosContext.Provider>;
};

export function useCostos(){
  const ctx = useContext(CostosContext);
  
  // Para evitar errores durante la compilación o SSR, nunca lanzamos un error
  // En su lugar, devolvemos un contexto falso/mock que funciona como fallback
  const fallbackCtx: CostosContextValue = {
    loading: false,
    error: null,
    datos: null,
    filtros: { fechaInicio: '', fechaFin: '', tipoVista: 'diario' },
    aplicarFiltros: () => {
      if (typeof window !== 'undefined') {
        console.error('Error: useCostos se está utilizando fuera de CostosProvider');
      }
    },
    recargarDatos: async () => {
      if (typeof window !== 'undefined') {
        console.error('Error: useCostos se está utilizando fuera de CostosProvider');
      }
    }
  };
  
  // Solo emitimos una advertencia en el cliente, pero nunca lanzamos un error
  if (typeof window !== 'undefined' && !ctx) {
    console.warn('Advertencia: useCostos debe usarse dentro de CostosProvider');
  }
  
  return ctx || fallbackCtx;
}
