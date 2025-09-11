"use client";
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { cacheGet, cacheSet } from '@/utils/cache';
import { useDashboard } from '@/context/DashboardContext';
import { AIAnalysisResult, AIAnalysisInsights } from '@/utils/types';

export interface IAAnalytics {
  insights: string[];
  recommendations: string[];
  trends: Record<string, string>;
  rawData: any;
  timestamp: string;
  text?: string;
}

export type IAAnalysisType = 'general' | 'costos' | 'productividad' | 'tendencias' | 'recomendaciones' | 'personalizado';

export interface IAQuery {
  prompt?: string;
  tipo: IAAnalysisType;
  detalle?: boolean;
}

interface IAContextValue {
  loading: boolean;
  error: string | null;
  analytics: IAAnalytics | null;
  fullText: string | null;
  history: { query: IAQuery; result: IAAnalytics }[];
  consultarIA: (query: IAQuery) => Promise<IAAnalytics>;
  clearHistory: () => void;
}

const IAContext = createContext<IAContextValue | undefined>(undefined);

const TTL_MS = 30 * 60 * 1000; // 30 minutos de caché

export const IAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { filtros } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<IAAnalytics | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [history, setHistory] = useState<{ query: IAQuery; result: IAAnalytics }[]>([]);

  const consultarIA = useCallback(async (query: IAQuery): Promise<IAAnalytics> => {
    setLoading(true);
    setError(null);
    
    const cacheKey = `ia-analytics:${filtros.fechaInicio}:${filtros.fechaFin}:${query.tipo}:${query.prompt || ''}:v2`;
    const cached = cacheGet<IAAnalytics>(cacheKey);
    
    if (cached) {
      setAnalytics(cached);
      setFullText(cached.text || null);
      setLoading(false);
      return cached;
    }
    
    try {
      console.log('Iniciando consulta IA:', query);
      
      // Preparar datos para la API
      const requestBody = {
        filters: {
          inicio: filtros.fechaInicio,
          fin: filtros.fechaFin
        },
        tipoAnalisis: query.tipo,
        ...(query.tipo === 'personalizado' && query.prompt ? { promptPersonalizado: query.prompt } : {})
      };
      
      console.log('Enviando solicitud a API de IA:', requestBody);
      
      // Llamar a la API
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en la API de IA: ${errorText}`);
      }
      
      // Procesar la respuesta
      const apiResult = await response.json() as AIAnalysisResult;
      
      console.log('Respuesta de API de IA recibida:', {
        queryType: apiResult.queryType,
        insightsCount: apiResult.insights.mainPoints.length,
        timestamp: apiResult.dataTimestamp
      });
      
      // Transformar la respuesta al formato esperado por el contexto
      const iaAnalytics: IAAnalytics = {
        insights: apiResult.insights.mainPoints || [],
        recommendations: apiResult.insights.recommendations || [],
        trends: {
          productividad: apiResult.insights.productivityTrend || 'estable',
          costos: apiResult.insights.costTrend || 'estable'
        },
        rawData: {
          tipo: apiResult.queryType,
          timestamp: apiResult.dataTimestamp
        },
        timestamp: apiResult.dataTimestamp,
        text: apiResult.text
      };
      
      setAnalytics(iaAnalytics);
      setFullText(apiResult.text);
      
      // Guardar en historial
      setHistory(prev => {
        const newHistory = [...prev, { query, result: iaAnalytics }];
        // Mantener solo los últimos 10 análisis
        if (newHistory.length > 10) {
          return newHistory.slice(0, 10);
        }
        return newHistory;
      });
      
      // Guardar en caché
      cacheSet(cacheKey, iaAnalytics, TTL_MS);
      
      return iaAnalytics;
    } catch (e: any) {
      const errorMsg = e.message || "Error al realizar análisis de IA";
      console.error('Error en consulta IA:', errorMsg);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [filtros]);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const value = useMemo(() => ({
    loading,
    error,
    analytics,
    fullText,
    history,
    consultarIA,
    clearHistory
  }), [loading, error, analytics, fullText, history, consultarIA, clearHistory]);

  return <IAContext.Provider value={value}>{children}</IAContext.Provider>;
};

export function useIA() {
  const context = useContext(IAContext);
  if (!context) {
    throw new Error("useIA debe usarse dentro de un IAProvider");
  }
  return context;
}
