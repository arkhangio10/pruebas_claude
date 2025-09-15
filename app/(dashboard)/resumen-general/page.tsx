import React, { Suspense, lazy } from 'react';
const FiltroDashboard = lazy(()=> import('@/dashboard/FiltroDashboard').then(m=>({default:m.default})));
const KpisDashboard = lazy(()=> import('@/dashboard/KpisDashboard').then(m=>({default:m.KpisDashboard})));
const ResumenDiario = lazy(()=> import('@/dashboard/ResumenDiario').then(m=>({default:m.default})));
const AnalisisProductividad = lazy(()=> import('@/dashboard/AnalisisProductividad').then(m=>({default:m.default})));
const AnalisisTrabajadores = lazy(()=> import('@/dashboard/AnalisisTrabajadores').then(m=>({default:m.default})));
const AnalisisCostos = lazy(()=> import('@/dashboard/AnalisisCostos').then(m=>({default:m.default})));
const AnalisisIABigQuery = lazy(()=> import('@/dashboard/AnalisisIABigQuery').then(m=>({default:m.AnalisisIABigQuery})));
const ConsultasPanel = lazy(()=> import('@/dashboard/ConsultasPanel').then(m=>({default:m.default})));
const GraficaEspecializada = lazy(()=> import('@/dashboard/GraficaEspecializada').then(m=>({default:m.default})));

export default function ResumenGeneralPage(){
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-lg font-semibold">Filtros Globales del Dashboard</div>
        </div>
  <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><FiltroDashboard /></Suspense>
      </div>
  <Suspense fallback={<div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"/>}><KpisDashboard /></Suspense>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><ResumenDiario /></Suspense>
            <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><AnalisisProductividad /></Suspense>
            <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><AnalisisTrabajadores /></Suspense>
            <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><AnalisisCostos /></Suspense>
          </div>
        </div>
        <div className="space-y-6">
          <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><AnalisisIABigQuery /></Suspense>
          <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><ConsultasPanel /></Suspense>
          <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><GraficaEspecializada /></Suspense>
        </div>
      </div>
    </div>
  );
}
