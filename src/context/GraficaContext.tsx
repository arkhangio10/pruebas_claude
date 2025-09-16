"use client";
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Reporte } from '@/utils/types';
import { computeKpis } from '@/utils/kpis';

interface GraficaData {
  productividadData: { fecha: string; productividad: number }[];
  costosData: { fecha: string; costo: number }[];
  kpis: {
    productividadPromedio: number;
    actividadMasProductiva: string;
    totalReportes: number;
  };
  reportesDetallados: Reporte[];
}

interface GraficaContextType {
  data: GraficaData | null;
  loading: boolean;
  error: Error | null;
}

const GraficaContext = createContext<GraficaContextType | undefined>(undefined);

export const GraficaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { datos, loading, error } = useDashboard();

  const graficaData = useMemo<GraficaData | null>(() => {
    if (!datos || !datos.reportes || datos.reportes.length === 0) {
      return null;
    }

    const reportes = datos.reportes;
    const { productividadPromedio, actividadMasProductiva } = computeKpis(reportes);
    
    const productividadData = reportes.map(reporte => ({
      fecha: new Date(reporte.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      productividad: reporte.productividad || 0,
    }));

    const costosData = reportes.map(reporte => ({
        fecha: new Date(reporte.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        costo: reporte.costoTotal || 0
    }));

    return {
      productividadData,
      costosData,
      kpis: {
        productividadPromedio,
        actividadMasProductiva: actividadMasProductiva.nombre,
        totalReportes: reportes.length,
      },
      reportesDetallados: reportes,
    };
  }, [datos]);

  const value = {
    data: graficaData,
    loading,
    error,
  };

  return (
    <GraficaContext.Provider value={value}>
      {children}
    </GraficaContext.Provider>
  );
};

export const useGrafica = (): GraficaContextType => {
  const context = useContext(GraficaContext);
  if (context === undefined) {
    throw new Error('useGrafica debe usarse dentro de un GraficaProvider');
  }
  return context;
};
