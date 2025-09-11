"use client";
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface ProductividadFiltros {
  fechaInicio: string;
  fechaFin: string;
  tipoVista: 'diario' | 'semanal' | 'mensual' | 'rango';
}

interface ProductividadActividad {
  id: string;
  nombre: string;
  metrado?: number; 
  horas?: number;
  horasOperario?: number;
  horasOficial?: number;
  horasPeon?: number;
  total?: number;
  avance?: string; // Incluye unidad de medida
  unidadMedida?: string;
  productividad?: number;
  fecha?: string;
  fechasDetalle?: string[];
}

interface ProductividadKpis { 
  totalHoras: number; 
  totalHorasOperario: number; 
  totalHorasOficial: number; 
  totalHorasPeon: number;
  productividadPromedio: number;
  avancePromedio: number;
}

interface ProductividadData { 
  actividades: ProductividadActividad[]; 
  kpis: ProductividadKpis; 
}

interface ProductividadContextValue {
  loading: boolean; 
  error: string|null; 
  datos: ProductividadData | null;
  filtros: ProductividadFiltros; 
  aplicarFiltros: (f: Partial<ProductividadFiltros>)=>void; 
  recargarDatos: ()=>Promise<void>;
}

const ProductividadContext = createContext<ProductividadContextValue|undefined>(undefined);
const TTL_MS = 6 * 60 * 60 * 1000; // 6h caché
const CACHE_VERSION = 'p1';

async function fetchProductividad(f: ProductividadFiltros): Promise<ProductividadData> {
  // Añadir un parámetro timestamp para evitar caché del navegador
  const timestamp = Date.now();
  const params = new URLSearchParams({ 
    fechaInicio: f.fechaInicio, 
    fechaFin: f.fechaFin, 
    tipoVista: f.tipoVista,
    modulo: 'productividad', // Indicar el módulo para procesamiento específico
    forceDaily: '1', // Siempre usar datos diarios sumados
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
  return { 
    actividades: json.actividades || [], 
    kpis: json.kpis || {
      totalHoras: 0,
      totalHorasOperario: 0,
      totalHorasOficial: 0,
      totalHorasPeon: 0,
      productividadPromedio: 0,
      avancePromedio: 0
    }
  };
}

function cacheKey(f: ProductividadFiltros){
  // Incluir la hora actual redondeada a la hora más cercana para que expire automáticamente
  const hourKey = Math.floor(Date.now() / (1000 * 60 * 60));
  return `productividad:${CACHE_VERSION}:${f.tipoVista}:${f.fechaInicio}:${f.fechaFin}:${hourKey}`;
}

export const ProductividadProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const hoy = new Date().toISOString().slice(0,10);
  const [filtros, setFiltros] = useState<ProductividadFiltros>({ fechaInicio: hoy, fechaFin: hoy, tipoVista:'diario' });
  const [datos, setDatos] = useState<ProductividadData|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const aplicarFiltros = useCallback((f: Partial<ProductividadFiltros>) => {
    setFiltros(prev => ({ ...prev, ...f }));
  }, []);

  // Ref interna para evitar peticiones duplicadas sin convertirlo en dependencia del efecto
  const isFetchingRef = useRef(false);

  const recargarDatos = useCallback(async ()=>{
    if (isFetchingRef.current) {
      // Evita duplicados mientras una solicitud está en curso
      return;
    }
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Validación de formato de fechas
      if (!filtros.fechaInicio.match(/^[\d]{4}-[\d]{2}-[\d]{2}$/) ||
          !filtros.fechaFin.match(/^[\d]{4}-[\d]{2}-[\d]{2}$/)) {
        throw new Error("Formato de fecha inválido. Use YYYY-MM-DD.");
      }

      const ck = cacheKey(filtros);
      let usedCache = false;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(ck) : null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
            if (parsed.exp > Date.now()) {
              setDatos(parsed.v);
              usedCache = true;
            }
        } catch {}
      }
      if (!usedCache) {
        const data = await fetchProductividad(filtros);
        setDatos(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ck, JSON.stringify({ v: data, exp: Date.now() + TTL_MS }));
        }
      }
    } catch(e:any){
      setError(e.message || 'Error');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [filtros]);

  // Auto recarga cada vez que cambian los filtros
  useEffect(()=>{
    // (1) Debounce para cambios rápidos de filtros
    const timer = setTimeout(() => {
      recargarDatos();
    }, 250);
    return () => clearTimeout(timer);
    // Importante: sólo depende de filtros para no crear bucles al cambiar 'loading'
  }, [filtros, recargarDatos]);

  const value = useMemo(()=>({ 
    loading, error, datos, filtros, aplicarFiltros, recargarDatos 
  }), [loading, error, datos, filtros, aplicarFiltros, recargarDatos]);
  
  return <ProductividadContext.Provider value={value}>{children}</ProductividadContext.Provider>;
};

export function useProductividad(){
  const ctx = useContext(ProductividadContext);
  
  // Para evitar errores durante la compilación o SSR, nunca lanzamos un error
  // En su lugar, devolvemos un contexto falso/mock que funciona como fallback
  const fallbackCtx: ProductividadContextValue = {
    loading: false,
    error: null,
    datos: null,
    filtros: { fechaInicio: '', fechaFin: '', tipoVista: 'diario' },
    aplicarFiltros: () => {
      if (typeof window !== 'undefined') {
        console.warn('Advertencia: useProductividad se está utilizando fuera de ProductividadProvider');
      }
    },
    recargarDatos: async () => {
      if (typeof window !== 'undefined') {
        console.warn('Advertencia: useProductividad se está utilizando fuera de ProductividadProvider');
      }
    }
  };
  
  // Solo emitimos una advertencia en el cliente, pero nunca lanzamos un error
  if (typeof window !== 'undefined' && !ctx) {
    console.warn('Advertencia: useProductividad debe usarse dentro de ProductividadProvider');
  }
  
  return ctx || fallbackCtx;
}
