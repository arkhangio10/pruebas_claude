import React, { Suspense, lazy } from 'react';
import { CostosProvider } from '@/context/CostosContext';
const AnalisisCostos = lazy(()=> import('@/dashboard/AnalisisCostos').then(m=>({default:m.default})));
const KpisCostos = lazy(()=> import('@/costos/KpisCostos').then(m=>({default:m.default})));
const FiltroCostos = lazy(()=> import('@/costos/FiltroCostos').then(m=>({default:m.default})));

export default function AnalisisCostosPage(){
  return (
    <CostosProvider>
      <div className="space-y-6">
        <Suspense fallback={<div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"/>}><FiltroCostos /></Suspense>
        <Suspense fallback={<div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"/>}><KpisCostos /></Suspense>
        <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><AnalisisCostos /></Suspense>
      </div>
    </CostosProvider>
  );
}
