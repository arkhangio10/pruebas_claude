import React, { Suspense, lazy } from 'react';

// Actualizamos la importación para que apunte al nuevo componente contenedor
const GraficaDashboard = lazy(() => import('@/dashboard/GraficaDashboard'));

export default function GraficaPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"/>
        </div>
      }>
        <GraficaDashboard />
      </Suspense>
    </div>
  );
}
