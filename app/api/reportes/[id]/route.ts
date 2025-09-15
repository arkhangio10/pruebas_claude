import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// Devuelve el detalle del reporte. Prioriza colección 'Reportes' (con subcolecciones) y
// cae a 'Reportes_Links' como respaldo.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Leer ambos orígenes en paralelo
    const [snapReportes, snapLinks] = await Promise.all([
      adminDb.collection('Reportes').doc(id).get(),
      adminDb.collection('Reportes_Links').doc(id).get(),
    ]);

    if (!snapReportes.exists && !snapLinks.exists) {
      return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
    }

    const dataR: any = snapReportes.exists ? (snapReportes.data() || {}) : {};
    const dataL: any = snapLinks.exists ? (snapLinks.data() || {}) : {};

    // Base: preferir campos de Reportes y completar con Links
    const base = {
      id: (snapReportes.exists ? snapReportes.id : snapLinks.id),
      elaboradoPor: dataR.elaboradoPor || dataR.creadoPor || dataL.creadoPor || dataL.elaboradoPor || 'Sin asignar',
      fecha: dataR.fecha || dataL.fecha || '',
      bloque: dataR.bloque || dataR.subcontratistaBLoque || dataL.subcontratistaBLoque || dataL.bloque || '',
      spreadsheetUrl: dataR.enlaceDrive || dataR.enlaceSheet || dataL.enlaceSheet || dataL.spreadsheetUrl || '',
      enlaceDrive: dataR.enlaceDrive || dataL.enlaceDrive || '',
      enlaceCarpeta: dataR.enlaceCarpeta || dataL.enlaceCarpeta || '',
      // Campos estado y error eliminados según requerimiento
      totalValorizado: (typeof dataR.totalValorizado === 'number' ? dataR.totalValorizado : (typeof dataL.totalValorizado === 'number' ? dataL.totalValorizado : 0)),
      totalTrabajadores: (typeof dataR.totalTrabajadores === 'number' ? dataR.totalTrabajadores : (typeof dataL.totalTrabajadores === 'number' ? dataL.totalTrabajadores : 0)),
      totalActividades: (typeof dataR.totalActividades === 'number' ? dataR.totalActividades : (typeof dataL.totalActividades === 'number' ? dataL.totalActividades : 0)),
    };

    // Mapas comunes
    const toNum = (v: any): number => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        let s = v.trim();
        // Manejar formatos con coma decimal (p.ej. 1.234,56)
        const hasComma = s.includes(',');
        const hasDot = s.includes('.');
        if (hasComma && !hasDot) {
          // 1.234 -> 1234 ; 123,45 -> 123.45
          s = s.replace(/\./g, '').replace(/,/g, '.');
        } else {
          // Eliminar separadores no numéricos excepto . -
          s = s.replace(/[^0-9.+-]/g, '');
        }
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      }
      return 0;
    };
    const firstNonEmpty = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && v !== '') ?? undefined;
    const mapActividad = (x: any) => {
      const nombre = firstNonEmpty(
        x.proceso, // Campo principal en subcolección actividades
        x.actividad,
        x.Actividad,
        x.nombre,
        x.nombreActividad,
        x.descripcionActividad,
        x.descripcion,
        x.tarea,
        x.item,
        x.partida,
        x.detalle
      ) || '';

      const metSrc = firstNonEmpty(
        x.metradoE, // Campo principal en subcolección actividades (metrado ejecutado)
        x.metrado,
        x.Metrado,
        x.metrados,
        x.metradoValor,
        x.metradoCantidad,
        x.cantidad,
        x.cantidadMetrado,
        x.avanceMetrado
      );
      const metrado = metSrc !== null && metSrc !== undefined ? toNum(metSrc) : null;

      // Metrado planificado como campo adicional (no se muestra pero puede ser útil)
      const metradoP = x.metradoP !== undefined ? toNum(x.metradoP) : undefined;

      const unidad = firstNonEmpty(
        x.und, // Campo principal en subcolección actividades
        x.unidad,
        x.Unidad,
        x.udm,
        x.UDM,
        x.unit,
        x.un,
        x.unidadMedida,
        x.unidad_medida,
        x.um
      );

      // Precio unitario para fallback - en subcolección es "precio"
      const pu = toNum(firstNonEmpty(
        x.precio, // Campo principal en subcolección actividades
        x.precioUnitario,
        x.precio_unitario,
        x.pu,
        x.costoUnitario,
        x.costo_unitario,
        x.valorUnitario,
        x.valor_unitario
      ));

      // Números de documento/secuencia/orden si existen
      const numero = firstNonEmpty(x.numero, x.item, x.secuencia, x.orden);

      // Campo ubicacion si existe
      const ubicacion = firstNonEmpty(x.ubicacion, x.ubicacionActividad, x.lugar);

      let valRaw = firstNonEmpty(
        x.valorTotal,
        x.valor_total,
        x.total,
        x.Total,
        x.importeTotal,
        x.importe,
        x.monto,
        x.valor,
        x.costo_total
      );
      let valorTotal = toNum(valRaw);
      // En subcolección, debe calcular valorTotal = precio × metradoE
      if (!valorTotal && pu && metrado) valorTotal = pu * metrado;

      return {
        actividad: nombre,
        metrado,
        unidad: unidad || undefined,
  valorTotal,
  causas: firstNonEmpty(x.causas, x.causasNoCumplimiento, x.causa, x.motivo, ''),
  comentarios: firstNonEmpty(x.comentarios, x.comentario, x.observaciones, ''),
  numero, // Incluir número si existe
  ubicacion, // Incluir ubicación si existe
  metradoP, // Incluir metrado planificado si existe
      };
    };
    // Tarifas por categoría (precio por hora)
    const TARIFAS_CATEGORIA: Record<string, number> = {
      'PEON': 15.50,
      'OFICIAL': 18.00,
      'OPERARIO': 22.50,
      'CAPATAZ': 30.00,
      'AYUDANTE': 15.50,
      'MAESTRO': 25.00,
      // Añadir más categorías según sea necesario
    };

    const mapMO = (x: any) => {
      // Para el caso de array de horas en subcolección mano_obra
      let horasArray = Array.isArray(x.horas) ? x.horas : [];
      
      // Calcular total de horas (sumando array o tomando el valor directo)
      let totalHorasCalculado = 0;
      if (horasArray.length > 0) {
        // Sumar todas las horas del array
        totalHorasCalculado = horasArray.reduce((sum: number, h: any) => sum + toNum(h), 0);
      }
      
      const horas = totalHorasCalculado || toNum(firstNonEmpty(
        x.totalHoras,
        x.TotalHoras,
        x.total_horas,
        // Si x.horas no es array pero es valor directo
        !Array.isArray(x.horas) ? x.horas : null,
        x.Horas,
        x.horasTrabajadas,
        x.horas_trabajadas,
        x.horasLaboradas,
        x.horas_laboradas
      ));
      
      // Obtener la categoría para buscar tarifa
      const categoria = firstNonEmpty(
        x.categoria, 
        x.Categoria, 
        x.cargo, 
        x.Cargo,
        ''
      );
      
      // Obtener costo por hora según categoría o de campos directos
      const costoHora = toNum(firstNonEmpty(
        x.costoHora,
        x.costo_hora,
        x.tarifa,
        x.precioHora,
        x.precio_hora,
        x.pu,
        x.precioUnitario,
        // Buscar tarifa por categoría como último recurso
        categoria ? TARIFAS_CATEGORIA[categoria.toUpperCase()] : undefined
      ));
      
      // Costo total directo o calculado
      let costo = toNum(firstNonEmpty(
        x.costoMO,
        x.CostoMO,
        x.costo_mo,
        x.costo,
        x.costoTotal,
        x.importe,
        x.monto
      ));
      
      // Si no hay costo pero tenemos horas y costoHora, calcularlo
      if (!costo && horas && costoHora) costo = horas * costoHora;

      return {
        trabajador: firstNonEmpty(x.trabajador, x.Trabajador, x.nombre, x.Nombre, x.trabajadorNombre) || '',
        categoria: firstNonEmpty(x.categoria, x.Categoria, x.cargo, x.Cargo) || '',
        dni: x.dni || x.DNI || x.documento || '',
        especificacion: x.especificacion || x.Especificacion || x.detalle || '',
        totalHoras: horas,
        costoMO: costo,
        horasArray: Array.isArray(x.horas) ? x.horas : [],
        item: x.item || x.Item || x.orden || x.secuencia,
        observacion: firstNonEmpty(x.observacion, x.Observacion, x.comentario, x.observaciones) || '',
      };
    };

    // Detalles: preferir subcolecciones de Reportes; si no hay, arrays de Links
    let actividades: any[] = [];
    let manoObra: any[] = [];

    let debug: any = {};
    if (snapReportes.exists) {
      const actsSnap = await adminDb.collection('Reportes').doc(id).collection('actividades').get();
      const moSnap = await adminDb.collection('Reportes').doc(id).collection('mano_obra').get();
      actividades = actsSnap.docs.map(d => mapActividad(d.data()));
      manoObra = moSnap.docs.map(d => mapMO(d.data()));
      debug.subcollections = { actividades: actsSnap.size, mano_obra: moSnap.size };
    }

  const actsL: any[] = snapLinks.exists ? (Array.isArray(dataL.actividades) ? dataL.actividades : (Array.isArray(dataL.actividadesDetalladas) ? dataL.actividadesDetalladas : [])) : [];
  const moL: any[] = snapLinks.exists ? (Array.isArray(dataL.manoObra) ? dataL.manoObra : (Array.isArray(dataL.trabajadoresDetalle) ? dataL.trabajadoresDetalle : [])) : [];
  // Usar la fuente más rica (mayor cantidad) para cada lista
  const actividadesFromLinks = actsL.map(mapActividad);
  const manoObraFromLinks = moL.map(mapMO);
  if (actividadesFromLinks.length > actividades.length) actividades = actividadesFromLinks;
  if (manoObraFromLinks.length > manoObra.length) manoObra = manoObraFromLinks;

    // Derivar totales si no vinieron en base
    const baseWithTotals = {
      ...base,
      totalActividades: base.totalActividades || actividades.length,
      totalTrabajadores: base.totalTrabajadores || manoObra.length,
      totalValorizado: base.totalValorizado || actividades.reduce((s, a) => s + (a.valorTotal || 0), 0),
    };

    return NextResponse.json({ ok: true, reporte: baseWithTotals, detalles: { actividades, manoObra }, debug });
  } catch (error) {
    console.error('[GET /api/reportes/[id]] error:', error);
    return NextResponse.json({ error: 'Error al obtener detalle del reporte' }, { status: 500 });
  }
}
