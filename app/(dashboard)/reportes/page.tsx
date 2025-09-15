import React from 'react';
import { ReportesProvider } from '../../../src/context/ReportesContext';
import TablaReportes from '../../../src/components/reportes/TablaReportes';

export default function ReportesPage(){
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reportes</h2>
      <p className="text-gray-600">
        Gestión y seguimiento de los reportes de productividad.
      </p>
      <ReportesProvider>
        <TablaReportes />
      </ReportesProvider>
    </div>
  );
}
