'use client';
import React from 'react';
import { useAuthState } from '@/components/useAuthState';
import { useResumenPeriodo, useTopActividades, useTopTrabajadores } from '@/components/useDashboardData';

export function DashboardPage(): JSX.Element {
  const { user, signInAnonymously, signOut } = useAuthState();
  const today = new Date().toISOString().split('T')[0];
  const { resumen, loading: loadingResumen } = useResumenPeriodo('diario', today, today);
  const { actividades } = useTopActividades(10);
  const { trabajadores } = useTopTrabajadores(10);

  return (
    <div className="grid">
      <header className="row" style={{ alignItems: 'center' }}>
        <h1 className="grow">Hergonsa Dashboard</h1>
        <div>
          {!user ? (
            <button onClick={signInAnonymously}>Ingresar (anónimo)</button>
          ) : (
            <button onClick={signOut}>Salir</button>
          )}
        </div>
      </header>

      <section className="row">
        <div className="kpi grow">
          <div className="muted">Fecha</div>
          <div>{today}</div>
        </div>
        <div className="kpi grow">
          <div className="muted">Valor Total</div>
          <div>{loadingResumen ? '...' : (resumen?.metricas?.valorTotal ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</div>
        </div>
        <div className="kpi grow">
          <div className="muted">Costo MO</div>
          <div>{loadingResumen ? '...' : (resumen?.metricas?.costoTotal ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</div>
        </div>
        <div className="kpi grow">
          <div className="muted">Ganancia</div>
          <div>{loadingResumen ? '...' : (resumen?.metricas?.ganancia ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</div>
        </div>
      </section>

      <section className="row">
        <div className="card grow">
          <h3>Top Actividades</h3>
          <table>
            <thead>
              <tr>
                <th>Actividad</th>
                <th>UND</th>
                <th>Metrado</th>
                <th>Valor</th>
                <th>Horas</th>
              </tr>
            </thead>
            <tbody>
              {actividades.map(a => (
                <tr key={a.id}>
                  <td>{a.nombre}</td>
                  <td>{a.unidad}</td>
                  <td>{(a.acumulado?.metrado ?? 0).toLocaleString()}</td>
                  <td>{(a.acumulado?.valor ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</td>
                  <td>{(a.acumulado?.horas ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card grow">
          <h3>Top Trabajadores</h3>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Horas</th>
                <th>Costo MO</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.map(t => (
                <tr key={t.id}>
                  <td>{t.datos?.nombre ?? t.nombre}</td>
                  <td>{t.datos?.categoria ?? t.categoria}</td>
                  <td>{(t.resumen?.horas ?? 0).toLocaleString()}</td>
                  <td>{(t.resumen?.costoMO ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

