// bigqueryService.js (ALINEADO A ESQUEMAS hergonsa_reportes_detallados & hergonsa_resumen_diario)
// Inserta filas planas por combinación actividad-trabajador y un resumen diario agregado.

const { BigQuery } = require('@google-cloud/bigquery');
const { COSTOS_POR_HORA, extraerPrecioUnitario } = require('./utils');

let bqClient;
function getClient() { if (!bqClient) bqClient = new BigQuery({ keyFilename: './credenciales.json' }); return bqClient; }

const DATASET_ANALYTICS = 'hergonsa_analytics';
const TABLE_DETALLADOS = 'hergonsa_reportes_detallados';
const TABLE_RESUMEN = 'hergonsa_resumen_diario';

/**
 * Inserta datos en BigQuery asegurando no duplicar (idempotencia básica mediante búsqueda previa por reporte_id).
 * @param {object} reporteData Doc principal del reporte { id, fecha, elaboradoPor, ... }
 * @param {Array<object>} actividades Lista de actividades (metradoP, metradoE, proceso, und, precioUnitario...)
 * @param {Array<object>} manoObra Lista de trabajadores ({ trabajador, categoria, horas:[] })
 */
async function enviarReporteDetalladoABigQuery(reporteData, actividades, manoObra) {
  if (!reporteData?.id || !reporteData?.fecha) {
    console.warn('BigQuery: reporte sin id/fecha, se omite.');
    return;
  }
  const client = getClient();

  // Verificación simple de duplicado: contar filas existentes con ese reporte_id
  try {
    const dupQuery = `SELECT COUNT(1) c FROM \`pruebas-9e15f.${DATASET_ANALYTICS}.${TABLE_DETALLADOS}\` WHERE reporte_id=@rid`;
    const [dupRows] = await client.query({ query: dupQuery, params: { rid: reporteData.id } });
    if ((dupRows[0]?.c || 0) > 0) {
      console.log(`BigQuery: reporte ${reporteData.id} ya presente, skip.`);
      return;
    }
  } catch (e) {
    console.warn('BigQuery: no se pudo verificar duplicado (continuando):', e.message);
  }

  // Precalcular horas totales por actividad (columna) sumando horas de todos los trabajadores
  const horasTotalesActividad = new Array(actividades.length).fill(0);
  manoObra.forEach(trab => {
    if (Array.isArray(trab.horas)) {
      trab.horas.forEach((h,i)=>{ if(i<horasTotalesActividad.length) horasTotalesActividad[i]+=parseFloat(h||0); });
    }
  });

  const filasDetalladas = [];
  let acumuladoCosto = 0, acumuladoValor = 0, acumuladoHoras = 0, acumuladoMetradoE = 0, acumuladoMetradoP = 0;

  actividades.forEach((act, actIndex) => {
    const metradoP = parseFloat(act.metradoP || 0);
    const metradoE = parseFloat(act.metradoE || 0);
    const precioUnit = extraerPrecioUnitario(act);
    const valorMetrado = metradoE * precioUnit;
    acumuladoMetradoE += metradoE;
    acumuladoMetradoP += metradoP;
    acumuladoValor += valorMetrado;

    manoObra.forEach(trab => {
      const horas = Array.isArray(trab.horas) && trab.horas.length>actIndex ? parseFloat(trab.horas[actIndex]||0) : 0;
      if (horas <= 0) return; // Solo filas con participación
      const categoria = (trab.categoria||'').toUpperCase();
      const costoHora = COSTOS_POR_HORA[categoria] || 0;
      const costoTotal = horas * costoHora;
      acumuladoCosto += costoTotal;
      acumuladoHoras += horas;

      // Asignación proporcional de metrado al trabajador según sus horas sobre total horas actividad
      const horasActividadTotal = horasTotalesActividad[actIndex] || 0;
      // Productividad y ganancia se calculan a nivel de trabajador sobre la porción de metrado imputada
      const metradoEjecutadoTrab = horasActividadTotal>0 ? metradoE * (horas/horasActividadTotal) : 0;
      const productividad = horas>0 ? metradoEjecutadoTrab/horas : 0;
      const ganancia = (metradoEjecutadoTrab * precioUnit) - costoTotal;
      const eficienciaActividad = (valorMetrado>0 && costoTotal>0) ? (valorMetrado / costoTotal) : 0;

      filasDetalladas.push({
        // Claves
        reporte_id: reporteData.id,
        fecha: (reporteData.fecha || '').substring(0,10), // Asegurar formato DATE YYYY-MM-DD
        elaborado_por: reporteData.elaboradoPor || reporteData.creadoPor || null,
        subcontratista_bloque: reporteData.subcontratistaBloque || null,
        revisado_por: reporteData.revisadoPor || null,
        trabajador_nombre: trab.trabajador || trab.nombre || null,
        trabajador_categoria: categoria || null,
        trabajador_especificacion: trab.especificacion || null,
        actividad_proceso: act.proceso || act.nombre || null,
        actividad_und: act.und || act.unidad || act.UND || null,
        actividad_ubicacion: act.ubicacion || null,
        actividad_numero: act.numero ? parseInt(act.numero) : null,
        // Métricas actividad global
        metrado_programado: metradoP,
        metrado_ejecutado: metradoE,
        porcentaje_avance: metradoP>0? (metradoE/metradoP)*100 : 0,
        precio_unitario: precioUnit,
        valor_metrado: valorMetrado,
        // Métricas específicas trabajador
        horas_trabajadas: horas,
        costo_hora: costoHora,
        costo_total: costoTotal,
        productividad: productividad,
        ganancia: ganancia,
  eficiencia_actividad: eficienciaActividad,
        causas_no_cumplimiento: act.causas || null,
        comentarios_actividad: act.comentarios || null,
        observacion_trabajador: trab.observacion || null,
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date()
      });
    });
  });

  // Insert filas detalladas
  if (filasDetalladas.length === 0) {
    console.warn(`BigQuery: reporte ${reporteData.id} sin filas detalladas (no horas) – se inserta solo resumen.`);
  } else {
    try {
      await client.dataset(DATASET_ANALYTICS).table(TABLE_DETALLADOS).insert(filasDetalladas);
      console.log(`BigQuery: ${filasDetalladas.length} filas insertadas en ${TABLE_DETALLADOS} (reporte ${reporteData.id}).`);
    } catch (e) {
      console.error('BigQuery: error insertando filas detalladas:', JSON.stringify(e, null, 2));
    }
  }

  // Resumen diario (1 fila por reporte/fecha)
  const resumen = [{
    fecha: reporteData.fecha,
    reporte_id: reporteData.id,
    elaborado_por: reporteData.elaboradoPor || reporteData.creadoPor || null,
    total_valorizado: acumuladoValor,
    total_costo_mo: acumuladoCosto,
    ganancia_total: acumuladoValor - acumuladoCosto,
    margen_ganancia: acumuladoValor>0 ? ((acumuladoValor - acumuladoCosto)/acumuladoValor)*100 : 0,
    total_metrado_ejecutado: acumuladoMetradoE,
    total_metrado_programado: acumuladoMetradoP,
    total_horas: acumuladoHoras,
    productividad_promedio: acumuladoHoras>0 ? (acumuladoMetradoE/acumuladoHoras) : 0,
    total_actividades: actividades.length,
    total_trabajadores: manoObra.length,
    fecha_creacion: new Date()
  }];

  try {
    await client.dataset(DATASET_ANALYTICS).table(TABLE_RESUMEN).insert(resumen);
    console.log(`BigQuery: resumen insertado en ${TABLE_RESUMEN} para reporte ${reporteData.id}.`);
  } catch (e) {
    console.error('BigQuery: error insertando resumen diario:', JSON.stringify(e, null, 2));
  }
}

module.exports = { enviarReporteDetalladoABigQuery };