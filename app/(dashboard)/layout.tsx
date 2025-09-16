"use client";
import React, { useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { DashboardProvider } from '@/context/DashboardContext';
import dynamic from 'next/dynamic';
const FiltroDashboard = dynamic(()=> import('@/dashboard/FiltroDashboard'), { ssr:false });
import Link from 'next/link';
const DownloadDataModal = dynamic(()=> import('@/dashboard/DownloadDataModal'), { ssr:false });
import { usePathname } from 'next/navigation';

function Sidebar() {
  const pathname = usePathname();
  const items: { label:string; href:string }[] = [
    { label:'Costos', href:'/analisis-costos' },
    { label:'Productividad', href:'/productividad' },
    { label:'Trabajadores', href:'/trabajadores' },
    { label:'Reportes', href:'/reportes' },
    { label:'IA', href:'/ia' },
    { label:'Gráfica', href:'/grafica' },
  ];
  return (
  <aside className="hidden md:flex flex-col w-60 border-r border-blue-800 bg-[linear-gradient(to_bottom,#ffffff_0%,#ffffff_18%,#f8fafc_28%,#e0f2fe_40%,#cfe5fc_55%,#60a5fa_72%,#1e3a8a_100%)]">
      <div className="px-4 pt-6 pb-4 flex justify-center border-b border-blue-200/60 bg-white/95">
        <img src="/logo_oficial.png" alt="HERGONSA" className="h-24 w-auto select-none" />
      </div>
  <nav className="flex-1 px-2 space-y-1 text-sm pt-2 text-blue-800">
        {items.map(it => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`w-full block px-3 py-2 rounded-md transition-colors flex gap-2 items-center text-sm font-medium ${active ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-blue-100/70 hover:text-blue-900'} `}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-blue-800/40 text-xs space-y-2 mt-auto text-blue-50">
        <div className="truncate font-medium">test_user@hergonsa.pe</div>
        <div className="text-blue-100/90">Supervisor de Obra</div>
        <button className="text-left text-red-300 hover:text-red-200 text-xs">Cerrar sesión</button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [openDownload, setOpenDownload] = useState(false);
  const path = usePathname();
  return (
    <AuthProvider>
      <DashboardProvider>
        <div className="flex h-screen overflow-hidden bg-gray-100">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-y-auto">
            <header className="h-16 bg-white border-b flex items-center px-6 gap-4">
              <div className="text-xl font-semibold">Dashboard Producción</div>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={()=>setOpenDownload(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm shadow-sm">Descargar Datos</button>
                <button className="bg-white border px-3 py-1.5 rounded-md text-sm shadow-sm flex items-center gap-2">Pruebas ▾</button>
              </div>
            </header>
            <div className="p-6 space-y-6">
              {path !== '/analisis-costos' && path !== '/productividad' && path !== '/trabajadores' && path !== '/reportes' && <FiltroDashboard />}
              {children}
            </div>
            <DownloadDataModal open={openDownload} onClose={()=>setOpenDownload(false)} />
          </div>
        </div>
      </DashboardProvider>
    </AuthProvider>
  );
}
