import React, { Suspense, lazy } from 'react';
import { TrabajadoresProvider } from '@/context/TrabajadoresContext';
const AnalisisTrabajadoresDetalle = lazy(() => import('../../../src/components/trabajadores/AnalisisTrabajadoresDetalle'));
const KpisDashboard = lazy(() => import('@/dashboard/KpisDashboard').then(m => ({ default: m.KpisDashboard })));

export default function TrabajadoresPage() {
  return (
    <div className="space-y-6">
      {/* KPIs no son necesarios aquí para esta vista específica como en la imagen de referencia */}
      <TrabajadoresProvider>
        <Suspense fallback={<div className="flex justify-center items-center h-96"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
          <AnalisisTrabajadoresDetalle />
        </Suspense>
      </TrabajadoresProvider>
    </div>
  );
}
