import React, { Suspense, lazy } from 'react';
const ResumenDiario = lazy(()=> import('@/dashboard/ResumenDiario').then(m=>({default:m.default})));
const KpisDashboard = lazy(()=> import('@/dashboard/KpisDashboard').then(m=>({default:m.KpisDashboard})));
export default function ResumenDiarioPage(){
  return (
    <div className="space-y-6">
  <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}><KpisDashboard /></Suspense>
  <Suspense fallback={<div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"/>}><ResumenDiario /></Suspense>
    </div>
  );
}
