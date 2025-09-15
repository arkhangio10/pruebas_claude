import React, { Suspense, lazy } from 'react';
const GraficaEspecializada = lazy(()=> import('@/dashboard/GraficaEspecializada').then(m=>({default:m.default})));
export default function GraficaPage(){
  return (
    <div className="space-y-6">
  <Suspense fallback={<div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"/>}><GraficaEspecializada /></Suspense>
    </div>
  );
}
