import React, { Suspense, lazy } from 'react';
const IADashboard = lazy(() => import('../../../src/components/ia/IADashboard'));

export default function IAPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"/>
        </div>
      }>
        <IADashboard />
      </Suspense>
    </div>
  );
}
