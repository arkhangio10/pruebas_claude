"use client";
import React from 'react';
import { GraficaProvider, useGrafica } from '@/context/GraficaContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Componente para una tarjeta de KPI individual
const KpiCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
    <h4 className="text-sm text-gray-500 font-semibold">{title}</h4>
    <p className="text-2xl font-bold text-blue-600">{value}</p>
  </div>
);

// Componente interno para mostrar el contenido del dashboard
const GraficaDashboardContent: React.FC = () => {
  const { data, loading, error } = useGrafica();

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">Error al cargar los datos: {error.message}</div>;
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <h3 className="font-semibold text-sm mb-2">Análisis Gráfico</h3>
        <div className="text-xs text-gray-500">No hay datos disponibles para el período seleccionado.</div>
      </div>
    );
  }

  // Si hay datos, mostramos el contenido
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Análisis Gráfico</h2>
        <p className="text-sm text-gray-500">Visualización de la productividad y costos a lo largo del tiempo.</p>
      </div>

      {/* Sección de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Productividad Promedio" value={`${data.kpis.productividadPromedio.toFixed(2)}%`} />
        <KpiCard title="Actividad más Productiva" value={data.kpis.actividadMasProductiva} />
        <KpiCard title="Total de Reportes" value={data.kpis.totalReportes} />
      </div>

      {/* Gráfica de Productividad con Recharts */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-80">
          <h3 className="font-semibold text-sm mb-4">Evolución de Productividad y Costos</h3>
          <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.productividadData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="productividad" stroke="#8884d8" name="Productividad (%)" />
                  <Line yAxisId="right" type="monotone" dataKey="costo" stroke="#82ca9d" name="Costo (S/.)" data={data.costosData}/>
              </LineChart>
          </ResponsiveContainer>
      </div>
    </div>
  );
};

// El componente principal que exportamos
const GraficaDashboard: React.FC = () => {
  return (
    <GraficaProvider>
      <GraficaDashboardContent />
    </GraficaProvider>
  );
};

export default GraficaDashboard;
