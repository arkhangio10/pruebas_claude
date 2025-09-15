import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Hergonsa Dashboard',
  description: 'Producción y métricas'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

