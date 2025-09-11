"use client";
import React, { useMemo } from 'react';
import { useCostos } from '@/context/CostosContext';

// Formateador de moneda (placeholder PEN, ajustar según necesidad)
const fmt = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 });

/**
 * NOTA: Se asume que cada actividad puede traer opcionalmente los campos:
 *  - costoExpediente
 *  - costoManoObra
 *  - costoOperario, costoOficial, costoPeon
 *  - total (valor de la actividad)
 * Si no existen, se calculan placeholders:
 *  total = metradoE * precioUnitario
 *  costoExpediente = 10% del total
 *  costoOperario / costoOficial / costoPeon = 0 (o usar proporciones si se definen después)
 *  costoManoObra = suma de (operario + oficial + peon) si no viene explícito
 *  ganancia = total - (costoExpediente + costoManoObra)
 * Reemplazar lógica cuando se definan los verdaderos campos de origen.
 */
const AnalisisCostos: React.FC = () => {
  const { datos } = useCostos();

  const actividades = useMemo(() => {
    return (datos?.actividades || []).map(a => {
      const cOperario = a.costoOperario ?? 0;
      const cOficial = a.costoOficial ?? 0;
      const cPeon = a.costoPeon ?? 0;
      const detalle = cOperario + cOficial + cPeon;
      const costoManoObra = (a.costoManoObra ?? 0) || detalle;
      const total = a.total ?? 0;
  const costoExpediente = a.costoExpediente ?? total; // ahora costoExpediente = valor del periodo
  const ganancia = costoExpediente - costoManoObra; // nueva definición
  return { nombre: a.nombre, costoExpediente, costoManoObra, total, cOperario, cOficial, cPeon, ganancia };
    }).sort((a,b)=> b.total - a.total);
  }, [datos]);

  const totales = useMemo(() => {
    return actividades.reduce((acc, r) => {
      acc.costoExpediente += r.costoExpediente;
      acc.costoManoObra += r.costoManoObra;
      acc.cOperario += r.cOperario;
      acc.cOficial += r.cOficial;
      acc.cPeon += r.cPeon;
      acc.ganancia += r.ganancia;
      return acc;
    }, { costoExpediente: 0, costoManoObra: 0, cOperario: 0, cOficial: 0, cPeon: 0, ganancia: 0 });
  }, [actividades]);

  const mostrarOperario = totales.cOperario > 0;
  const mostrarOficial = totales.cOficial > 0;
  const mostrarPeon = totales.cPeon > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h3 className="font-semibold mb-4">Análisis de Costos por Actividad</h3>
      <div className="overflow-x-auto">
        <table className="text-xs md:text-sm w-full whitespace-nowrap">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 pr-4">Actividad</th>
              <th className="py-2 pr-4">Costo Expediente</th>
              <th className="py-2 pr-4">Costo Mano Obra</th>
              {mostrarOperario && <th className="py-2 pr-4">C. Operario</th>}
              {mostrarOficial && <th className="py-2 pr-4">C. Oficial</th>}
              {mostrarPeon && <th className="py-2 pr-4">C. Peón</th>}
              <th className="py-2 pr-4">Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {actividades.map((r, i) => (
              <tr key={r.nombre + i} className="border-t hover:bg-gray-50">
                <td className="py-1 pr-4 font-medium max-w-[220px] truncate" title={r.nombre}>{r.nombre}</td>
                <td className="py-1 pr-4">{fmt.format(r.costoExpediente)}</td>
                <td className="py-1 pr-4">{fmt.format(r.costoManoObra)}</td>
                {mostrarOperario && <td className="py-1 pr-4">{fmt.format(r.cOperario)}</td>}
                {mostrarOficial && <td className="py-1 pr-4">{fmt.format(r.cOficial)}</td>}
                {mostrarPeon && <td className="py-1 pr-4">{fmt.format(r.cPeon)}</td>}
                <td className={"py-1 pr-4 font-semibold " + (r.ganancia >= 0 ? 'text-green-600' : 'text-red-600')}>{fmt.format(r.ganancia)}</td>
              </tr>
            ))}
          </tbody>
          {actividades.length > 0 && (
            <tfoot>
              <tr className="border-t bg-gray-100 font-semibold text-gray-700">
                <td className="py-2 pr-4">Totales</td>
                <td className="py-2 pr-4">{fmt.format(totales.costoExpediente)}</td>
                <td className="py-2 pr-4">{fmt.format(totales.costoManoObra)}</td>
                {mostrarOperario && <td className="py-2 pr-4">{fmt.format(totales.cOperario)}</td>}
                {mostrarOficial && <td className="py-2 pr-4">{fmt.format(totales.cOficial)}</td>}
                {mostrarPeon && <td className="py-2 pr-4">{fmt.format(totales.cPeon)}</td>}
                <td className={"py-2 pr-4 " + (totales.ganancia >= 0 ? 'text-green-600' : 'text-red-600')}>{fmt.format(totales.ganancia)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {actividades.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">Sin actividades para el rango seleccionado.</div>
        )}
      </div>
      <p className="mt-3 text-[10px] text-gray-400 leading-snug">* Los valores marcados como placeholders deben sustituirse por los costos reales cuando estén disponibles en la fuente de datos.</p>
    </div>
  );
};

export default AnalisisCostos;
