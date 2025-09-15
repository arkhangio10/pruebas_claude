'use client';
import React, { Suspense, lazy } from 'react';
import { ProductividadProvider } from '@/context/ProductividadContext';

const FiltroProductividad = lazy(() => import('@/productividad/FiltroProductividad'));
const AnalisisProductividad = lazy(() => import('@/productividad/AnalisisProductividad'));

export default function ProductividadPage(){
  return (
    <ProductividadProvider>
      <div className="space-y-6">
        <Suspense fallback={<div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"/>}>
          <FiltroProductividad />
        </Suspense>
        <Suspense fallback={<div className="animate-spin h-6 w-6 border-4 border-blue-500 border-t-transparent rounded-full"/>}>
          <AnalisisProductividad />
        </Suspense>
      </div>
    </ProductividadProvider>
  );
}
