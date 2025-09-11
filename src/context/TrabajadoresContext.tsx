"use client";
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';

interface TrabajadorResumen {
  horas: number;
  metrado: number;
  costoMO: number;
  productividadMedia: number;
}

interface TrabajadorData {
  id: string;
  nombre: string;
  categoria: 'OPERARIO' | 'OFICIAL' | 'PEON';
  ultimaActividad?: string;
  horas: number;
  metrado: number;
  productividad: number;
  eficiencia: number;
  costoMO: number;
}

interface FiltrosTrabajadores {
  fechaInicio: string; // formato YYYY-MM-DD
  fechaFin: string;    // formato YYYY-MM-DD
  tipoVista: 'diario' | 'semanal' | 'mensual' | 'rango';
}

interface TrabajadoresContextValue {
  loading: boolean;
  error: string | null;
  trabajadores: TrabajadorData[];
  filtros: FiltrosTrabajadores;
  aplicarFiltros: (f: Partial<FiltrosTrabajadores>) => void;
  recargarDatos: () => Promise<void>;
}

const TrabajadoresContext = createContext<TrabajadoresContextValue | undefined>(undefined);

// Configuración de caché (misma filosofía que productividad)
const TTL_MS = 3 * 60 * 60 * 1000; // 3 horas
const CACHE_VERSION = 't1';

function cacheKey(f: FiltrosTrabajadores){
  const hourKey = Math.floor(Date.now() / (1000 * 60 * 60));
  return `trabajadores:${CACHE_VERSION}:${f.tipoVista}:${f.fechaInicio}:${f.fechaFin}:${hourKey}`;
}

export const TrabajadoresProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trabajadores, setTrabajadores] = useState<TrabajadorData[]>([]);
  const [filtros, setFiltros] = useState<FiltrosTrabajadores>(() => {
    // Configurar fecha actual como valor predeterminado
    const hoy = new Date();
    const fechaHoy = hoy.toISOString().slice(0,10);
    
    // Para la vista mensual, configurar desde el primer día del mes hasta hoy
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMes = primerDiaMes.toISOString().slice(0,10);

    return {
      fechaInicio: inicioMes,
      fechaFin: fechaHoy,
      tipoVista: 'mensual' // Comenzar con vista mensual por defecto
    };
  });
  
  const aplicarFiltros = useCallback((f: Partial<FiltrosTrabajadores>) => {
    setFiltros(prev => ({ ...prev, ...f }));
  }, []);
  
  // Ref para evitar solicitudes duplicadas concurrentes
  const isFetchingRef = useRef(false);

  const mapResponseToTrabajadores = (data: any): TrabajadorData[] => {
    if (!data.trabajadores || data.trabajadores.length === 0) return [];
    const trabajadoresList: TrabajadorData[] = [];
    data.trabajadores.forEach((item: any) => {
      const id = item.id;
      const nombreCompleto = item.nombre || id;
      let categoria: 'OPERARIO' | 'OFICIAL' | 'PEON';
      const categoriaData = item.categoria || '';
      if (categoriaData === 'OPERARIO') categoria = 'OPERARIO';
      else if (categoriaData === 'OFICIAL') categoria = 'OFICIAL';
      else if (categoriaData === 'PEON') categoria = 'PEON';
      else {
        const nombreUpper = nombreCompleto.toUpperCase();
        if (/(OPERARIO|MAMANI|FLORES|BEDOYA)/.test(nombreUpper)) categoria = 'OPERARIO';
        else if (/(OFICIAL|VILLALVA|GONZALES|QUISPE)/.test(nombreUpper)) categoria = 'OFICIAL';
        else categoria = 'PEON';
      }
      const horas = item.resumen?.horas || 0;
      const metrado = item.resumen?.metrado || 0;
      const costoMO = item.resumen?.costoMO || 0;
      const ultimaActividad = item.ultimaActividad || '';
      const productividadMedia = item.resumen?.productividadMedia || 0;
      const productividad = productividadMedia || (horas > 0 ? metrado / horas : 0);
      const eficiencia = 1.0;
      trabajadoresList.push({ id, nombre: nombreCompleto, categoria, ultimaActividad, horas, metrado, productividad, eficiencia, costoMO });
    });
    trabajadoresList.sort((a,b)=> b.productividad - a.productividad);
    return trabajadoresList;
  };

  const recargarDatos = useCallback(async () => {
    if (isFetchingRef.current) return; // Evita duplicados
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      if (!filtros.fechaInicio.match(/^\d{4}-\d{2}-\d{2}$/) || !filtros.fechaFin.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new Error('Formato de fecha inválido. Use YYYY-MM-DD.');
      }
      const ck = cacheKey(filtros);
      let usedCache = false;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(ck) : null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.exp > Date.now()) {
            setTrabajadores(parsed.v);
            usedCache = true;
          }
        } catch {}
      }
      if (!usedCache) {
        const queryParams = new URLSearchParams({
          fechaInicio: filtros.fechaInicio,
          fechaFin: filtros.fechaFin,
          tipoVista: filtros.tipoVista,
          ts: Date.now().toString()
        });
        const response = await fetch(`/api/trabajadores?${queryParams.toString()}`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        const list = mapResponseToTrabajadores(data);
        setTrabajadores(list);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ck, JSON.stringify({ v: list, exp: Date.now() + TTL_MS }));
        }
      }
    } catch (err:any) {
      console.error('Error al cargar datos de trabajadores:', err);
      setError(err.message || 'Error al cargar datos. Intente nuevamente más tarde.');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [filtros]);
  
  useEffect(() => {
    const timer = setTimeout(() => { recargarDatos(); }, 250);
    return () => clearTimeout(timer);
  }, [filtros, recargarDatos]);
  
  const value = useMemo(() => ({
    loading,
    error,
    trabajadores,
    filtros,
    aplicarFiltros,
    recargarDatos
  }), [loading, error, trabajadores, filtros, aplicarFiltros, recargarDatos]);
  
  return (
    <TrabajadoresContext.Provider value={value}>
      {children}
    </TrabajadoresContext.Provider>
  );
};

export const useTrabajadores = () => {
  const context = useContext(TrabajadoresContext);
  
  // Para evitar errores durante la compilación o SSR, nunca lanzamos un error
  // En su lugar, devolvemos un contexto falso/mock que funciona como fallback
  const fallbackCtx: TrabajadoresContextValue = {
    loading: false,
    error: null,
    trabajadores: [],
    filtros: { fechaInicio: '', fechaFin: '', tipoVista: 'diario' },
    aplicarFiltros: () => {
      if (typeof window !== 'undefined') {
        console.warn('Advertencia: useTrabajadores se está utilizando fuera de TrabajadoresProvider');
      }
    },
    recargarDatos: async () => {
      if (typeof window !== 'undefined') {
        console.warn('Advertencia: useTrabajadores se está utilizando fuera de TrabajadoresProvider');
      }
    }
  };
  
  // Solo emitimos una advertencia en el cliente, pero nunca lanzamos un error
  if (typeof window !== 'undefined' && !context) {
    console.warn('Advertencia: useTrabajadores debe usarse dentro de TrabajadoresProvider');
  }
  
  return context || fallbackCtx;
};
