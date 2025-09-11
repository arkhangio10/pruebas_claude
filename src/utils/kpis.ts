interface Actividad { metradoP?: number; metradoE?: number; precioUnitario?: number; trabajadores?: string[]; }
interface Reporte { actividades?: Actividad[]; }

export function computeKpis(reportes: Reporte[]) {
  let costoTotal = 0; let valorTotal = 0; let totalHoras = 0; let sumaProd = 0; let countProd = 0;
  reportes.forEach(r => {
    (r.actividades || []).forEach(a => {
      const mp = a.metradoP || 0; const me = a.metradoE || 0; const pu = a.precioUnitario || 0;
      const productividad = mp ? me / mp : 0;
      valorTotal += me * pu;
      costoTotal += me * pu * 0.6; // placeholder
      sumaProd += productividad; countProd += 1;
      totalHoras += (a.trabajadores?.length || 0) * 8; // placeholder
    });
  });
  const productividadPromedio = countProd ? sumaProd / countProd : 0;
  const ganancia = valorTotal - costoTotal;
  return { costoTotal, valorTotal, productividadPromedio, totalHoras, ganancia };
}
