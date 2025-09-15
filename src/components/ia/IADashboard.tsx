"use client";
import React from 'react';
import  AnalisisIA  from '../../components/ia/AnalisisIA';
import { IAHistorial } from '../../components/ia/IAHistorial';
import IAResultado from '../../components/ia/IAResultado';
import { IAProvider } from '@/context/IAContext';

export default function IADashboard() {
  return (
    <IAProvider>
      <div className="space-y-6">
        <AnalisisIA />
        <IAHistorial />
      </div>
    </IAProvider>
  );
}
