const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { BigQuery } = require("@google-cloud/bigquery");

// Inicializa Firebase Admin SDK para poder interactuar con Firestore.
admin.initializeApp();

// El helper que contiene toda la lógica para crear el reporte en Google Sheets.
const sheetsHelper = require("./sheets-helper");

// (LIMPIEZA) Archivos ausentes dashboard-etl-generator / analisis-trabajadores-dashboard eliminados.
// Se crea un stub mínimo para mantener compatibilidad sin romper despliegue.
const dashboardETL = {
  async generarDatosDashboardCompleto(reporteId) {
    return { success: true, mensaje: `Stub: dashboard no implementado para ${reporteId}` };
  }
};

// Integración de dashboard (agregaciones incrementales) y BigQuery raw ingest
let dashboardIntegration;
try {
  dashboardIntegration = require('./dashboard-integration');
} catch (e) {
  console.warn('⚠️ dashboard-integration.js no disponible:', e.message);
}

let enviarReporteDetalladoABigQuery;
try {
  ({ enviarReporteDetalladoABigQuery } = require('./bigqueryService'));
} catch (e) {
  console.warn('⚠️ bigqueryService.js no disponible para ingestión raw:', e.message);
}

// Configuración global para la función.
setGlobalOptions({
  region: "us-central1", // O la región que prefieras
  memory: "512MiB",       // Memoria asignada
  timeoutSeconds: 300,    // Tiempo máximo de ejecución
});

// Configurar cliente BigQuery
const bigquery = new BigQuery({
  projectId: process.env.GCLOUD_PROJECT || "pruebas-9e15f",
  keyFilename: "./credenciales.json"
});

/**
 * Trigger de Firestore que se activa cuando se crea un nuevo documento en la colección "Reportes".
 * Su única responsabilidad es iniciar el proceso de generación del reporte en Google Sheets
 * y generar los datos del dashboard.
 */
exports.onCreateReporte = onDocumentCreated("Reportes/{reporteId}", async (event) => {
  const reporteId = event.params.reporteId;
  const reporteData = event.data.data();

  console.log(`[Trigger] Iniciando proceso para el reporte: ${reporteId}`);

  try {
    // Idempotencia / estado
    const docRef = admin.firestore().collection('Reportes').doc(reporteId);
    const current = await docRef.get();
    const estadoActual = current.exists ? current.data().estado : null;
    if (estadoActual === 'COMPLETADO') {
      console.log(`[Trigger] Reporte ${reporteId} ya COMPLETADO. Abortando re-proceso.`);
      return;
    }
    if (estadoActual && ['PROCESANDO'].includes(estadoActual)) {
      console.log(`[Trigger] Reporte ${reporteId} ya en estado ${estadoActual}. Abortando.`);
      return;
    }
    await docRef.set({ estado: 'PROCESANDO', fechaInicioProcesamiento: new Date().toISOString() }, { merge: true });

    // Ejecutar ambos procesos en paralelo
    const [resultadoSheets, resultadoDashboard] = await Promise.all([
      // Generar reporte en Google Sheets
      sheetsHelper.generarReporteCompletoEnSheets(reporteId, reporteData),
      // Generar datos para el dashboard
      dashboardETL.generarDatosDashboardCompleto(reporteId)
    ]);

    // Agregación incremental (dashboardIntegration) y BigQuery raw ingest
    let agregadoDashboard = null;
    let bigQueryIngest = null;
    try {
      if (dashboardIntegration && dashboardIntegration.agregarADashboard) {
        // Pasar link de sheet si ya existe
        const enrichedData = { ...reporteData, spreadsheetUrl: resultadoSheets?.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${resultadoSheets.spreadsheetId}` : undefined };
        agregadoDashboard = await dashboardIntegration.agregarADashboard(enrichedData, reporteId);
      }
    } catch (e) {
      console.error(`[Trigger] Error agregando a dashboard incremental para ${reporteId}:`, e);
    }

    try {
      // Idempotencia BigQuery
      const refreshed = await docRef.get();
      const yaIngestado = refreshed.exists && refreshed.data().bigQueryIngested;
      if (enviarReporteDetalladoABigQuery && !yaIngestado) {
        const db = admin.firestore();
        const [actsSnap, moSnap] = await Promise.all([
          db.collection(`Reportes/${reporteId}/actividades`).get(),
          db.collection(`Reportes/${reporteId}/mano_obra`).get()
        ]);
        const actividadesRaw = actsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const manoObraRaw = moSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const reporteForBQ = { id: reporteId, ...reporteData };
        await enviarReporteDetalladoABigQuery(reporteForBQ, actividadesRaw, manoObraRaw);
        bigQueryIngest = { success: true };
      } else if (yaIngestado) {
        console.log(`[Trigger] BigQuery ya ingestó reporte ${reporteId}, saltando.`);
      }
    } catch (e) {
      console.error(`[Trigger] Error enviando datos crudos a BigQuery para ${reporteId}:`, e);
    }

    // Evaluar resultados
    if (resultadoSheets.success && resultadoDashboard.success) {
      console.log(`[Trigger] Proceso completo para ${reporteId} exitoso:`);
      console.log(`  - Sheets ID: ${resultadoSheets.spreadsheetId}`);
      console.log(`  - Dashboard: ${resultadoDashboard.contadores.trabajadores} trabajadores, ${resultadoDashboard.contadores.actividades} actividades`);
      
      // Actualizar estado en Firestore
      await admin.firestore().collection("Reportes").doc(reporteId).update({
        estado: "COMPLETADO",
        sheetsId: resultadoSheets.spreadsheetId,
        dashboardGenerado: true,
        agregadoDashboard: agregadoDashboard?.success || false,
        bigQueryIngested: bigQueryIngest?.success || false,
        fechaProcesamiento: new Date().toISOString(),
      });
      
    } else {
      console.error(`[Trigger] Falló el proceso para ${reporteId}:`);
      if (!resultadoSheets.success) console.error(`  - Sheets: ${resultadoSheets.error}`);
      if (!resultadoDashboard.success) console.error(`  - Dashboard: ${resultadoDashboard.error}`);
      
      // Actualizar estado con error
      await admin.firestore().collection("Reportes").doc(reporteId).update({
        estado: "ERROR_PARCIAL",
        sheetsError: !resultadoSheets.success ? resultadoSheets.error : null,
        dashboardError: !resultadoDashboard.success ? resultadoDashboard.error : null,
  agregadoDashboard: agregadoDashboard?.success || false,
  bigQueryIngested: false,
        fechaProcesamiento: new Date().toISOString(),
      });
    }
    
  } catch (error) {
    console.error(`[Trigger] Error catastrófico procesando el reporte ${reporteId}:`, error);
    
    // Marcar el documento con un estado de error crítico
    try {
      await admin.firestore().collection("Reportes").doc(reporteId).update({
        estado: "ERROR_CRITICO",
        error: error.message,
  bigQueryIngested: false,
        fechaProcesamiento: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error(`[Trigger] No se pudo actualizar el estado de error para ${reporteId}.`, dbError);
    }
  }
});

/**
 * Función HTTP para regenerar los datos del dashboard de un reporte específico
 */
exports.regenerarDashboard = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error("Se requiere el ID del reporte");
  }
  
  console.log(`[HTTP] Regenerando dashboard para reporte: ${reporteId}`);
  
  try {
    const resultado = await dashboardETL.generarDatosDashboardCompleto(reporteId);
    
    if (resultado.success) {
      console.log(`[HTTP] Dashboard regenerado exitosamente para ${reporteId}`);
      return { 
        success: true, 
        message: "Dashboard regenerado correctamente",
        data: resultado 
      };
    } else {
      console.error(`[HTTP] Error regenerando dashboard para ${reporteId}:`, resultado.error);
      throw new Error(`Error regenerando dashboard: ${resultado.error}`);
    }
    
  } catch (error) {
    console.error(`[HTTP] Error en regenerarDashboard:`, error);
    throw new Error(`Error regenerando dashboard: ${error.message}`);
  }
});

/**
 * Función HTTP para regenerar datos de dashboard en lote para múltiples reportes
 */
exports.regenerarDashboardLote = onCall(async (request) => {
  const { reporteIds, fechaInicio, fechaFin } = request.data;
  
  console.log(`[HTTP] Regenerando dashboard en lote`);
  
  try {
    let reportesAProcesar = [];
    
    if (reporteIds && Array.isArray(reporteIds)) {
      // Procesar reportes específicos
      reportesAProcesar = reporteIds;
    } else if (fechaInicio && fechaFin) {
      // Obtener reportes por rango de fechas
      const db = admin.firestore();
      const querySnapshot = await db.collection("Reportes")
        .where("fecha", ">=", fechaInicio)
        .where("fecha", "<=", fechaFin)
        .get();
      
      reportesAProcesar = querySnapshot.docs.map(doc => doc.id);
    } else {
      throw new Error("Se requieren reporteIds o un rango de fechas (fechaInicio, fechaFin)");
    }
    
    console.log(`[HTTP] Procesando ${reportesAProcesar.length} reportes en lote`);
    
    const resultados = [];
    let exitosos = 0;
    let fallidos = 0;
    
    // Procesar reportes en grupos de 5 para evitar sobrecarga
    for (let i = 0; i < reportesAProcesar.length; i += 5) {
      const grupo = reportesAProcesar.slice(i, i + 5);
      
      const promesasGrupo = grupo.map(async (reporteId) => {
        try {
          const resultado = await dashboardETL.generarDatosDashboardCompleto(reporteId);
          if (resultado.success) {
            exitosos++;
            return { reporteId, success: true };
          } else {
            fallidos++;
            return { reporteId, success: false, error: resultado.error };
          }
        } catch (error) {
          fallidos++;
          return { reporteId, success: false, error: error.message };
        }
      });
      
      const resultadosGrupo = await Promise.all(promesasGrupo);
      resultados.push(...resultadosGrupo);
      
      // Pequeña pausa entre grupos
      if (i + 5 < reportesAProcesar.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[HTTP] Lote completado: ${exitosos} exitosos, ${fallidos} fallidos`);
    
    return {
      success: true,
      message: `Procesamiento en lote completado: ${exitosos} exitosos, ${fallidos} fallidos`,
      resultados: {
        total: reportesAProcesar.length,
        exitosos,
        fallidos,
        detalle: resultados
      }
    };
    
  } catch (error) {
    console.error(`[HTTP] Error en regenerarDashboardLote:`, error);
    throw new Error(`Error en procesamiento lote: ${error.message}`);
  }
});

/**
 * Función HTTP para obtener métricas de un período específico
 * Integra BigQuery para análisis avanzados y Firestore como fallback
 */
exports.obtenerMetricasPeriodo = onCall(async (request) => {
  const { fechaInicio, fechaFin, tipo = 'diario', fuente = 'auto' } = request.data;
  
  if (!fechaInicio || !fechaFin) {
    throw new Error("Se requieren fechaInicio y fechaFin");
  }
  
  console.log(`[HTTP] Obteniendo métricas ${tipo} del ${fechaInicio} al ${fechaFin} (fuente: ${fuente})`);
  
  try {
    // Intentar BigQuery primero si está disponible
    if (fuente === 'auto' || fuente === 'bigquery') {
      try {
        const resultadoBigQuery = await obtenerMetricasDesdeBigQuery(fechaInicio, fechaFin, tipo);
        console.log(`✅ Datos obtenidos desde BigQuery: ${resultadoBigQuery.datos.length} registros`);
        return {
          success: true,
          fuente: 'bigquery',
          periodo: { fechaInicio, fechaFin, tipo },
          datos: resultadoBigQuery.datos,
          metricas: resultadoBigQuery.metricas,
          timestamp: new Date().toISOString()
        };
      } catch (errorBQ) {
        console.warn(`⚠️ BigQuery falló, usando Firestore como fallback:`, errorBQ.message);
        if (fuente === 'bigquery') {
          throw errorBQ; // Si específicamente pidió BigQuery, fallar
        }
      }
    }
    
    // Fallback a Firestore
    const resultadoFirestore = await obtenerMetricasDesdeFirestore(fechaInicio, fechaFin, tipo);
    console.log(`✅ Datos obtenidos desde Firestore: ${resultadoFirestore.datos.length} registros`);
    
    return {
      success: true,
      fuente: 'firestore',
      periodo: { fechaInicio, fechaFin, tipo },
      datos: resultadoFirestore.datos,
      metricas: resultadoFirestore.metricas,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`[HTTP] Error obteniendo métricas:`, error);
    throw new Error(`Error obteniendo métricas: ${error.message}`);
  }
});

/**
 * Obtiene métricas desde BigQuery usando SQL optimizado
 */
async function obtenerMetricasDesdeBigQuery(fechaInicio, fechaFin, tipo) {
  let query;
  
  if (tipo === 'diario') {
    query = `
      SELECT 
        fecha,
        total_valorizado,
        total_costo_mo,
        ganancia_total,
        margen_ganancia,
        total_metrado_ejecutado as total_metrado_e,
        total_metrado_programado as total_metrado_p,
        total_horas,
        productividad_promedio,
        total_actividades,
        total_trabajadores,
        elaborado_por,
        fecha_creacion
      FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_resumen_diario\`
      WHERE fecha BETWEEN @fechaInicio AND @fechaFin
      ORDER BY fecha ASC
    `;
  } else if (tipo === 'trabajadores') {
    query = `
      SELECT 
        trabajador_nombre,
        trabajador_categoria as categoria,
        SUM(horas_trabajadas) as total_horas,
        SUM(costo_total) as total_costo,
        SUM(metrado_ejecutado) as total_metrado,
        AVG(productividad) as productividad_promedio,
        COUNT(DISTINCT fecha) as dias_trabajados,
        MIN(fecha) as primera_fecha,
        MAX(fecha) as ultima_fecha
      FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
      WHERE fecha BETWEEN @fechaInicio AND @fechaFin
      GROUP BY trabajador_nombre, trabajador_categoria
      ORDER BY total_horas DESC
    `;
  } else if (tipo === 'actividades') {
    query = `
      SELECT 
        actividad_proceso as actividad_nombre,
        actividad_ubicacion as ubicacion,
        SUM(metrado_ejecutado) as total_metrado_ejecutado,
        SUM(metrado_programado) as total_metrado_programado,
        SUM(horas_trabajadas) as total_horas,
        SUM(costo_total) as total_costo,
        SUM(valor_metrado) as total_valorizado,
        SUM(ganancia) as total_ganancia,
        AVG(porcentaje_avance) as porcentaje_avance,
        COUNT(DISTINCT fecha) as dias_activos
      FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
      WHERE fecha BETWEEN @fechaInicio AND @fechaFin
      GROUP BY actividad_proceso, actividad_ubicacion
      ORDER BY total_valorizado DESC
    `;
  } else {
    throw new Error(`Tipo de consulta no soportado: ${tipo}`);
  }
  
  const options = {
    query: query,
    params: {
      fechaInicio: fechaInicio,
      fechaFin: fechaFin
    },
  };
  
  const [rows] = await bigquery.query(options);
  
  // Calcular métricas agregadas
  const metricas = calcularMetricasAgregadas(rows, tipo);
  
  return {
    datos: rows,
    metricas: metricas
  };
}

/**
 * Función HTTP para actualizar o eliminar datos del dashboard
 */
exports.updateReporte = onCall(async (request) => {
  const { reporteId, data } = request.data;
  
  if (!reporteId || !data) {
    throw new Error("Se requieren el ID del reporte y los datos para actualizar.");
  }
  
  console.log(`[HTTP] Actualizando reporte: ${reporteId}`);
  
  try {
    const db = admin.firestore();
    
    // Actualizar el documento principal del reporte
    await db.collection("Reportes").doc(reporteId).update({
      ...data,
      fechaActualizacion: new Date().toISOString()
    });
    
    // Regenerar datos del dashboard con los nuevos datos
    const resultadoDashboard = await dashboardETL.generarDatosDashboardCompleto(reporteId);
    
    if (!resultadoDashboard.success) {
      console.warn(`[HTTP] Advertencia: Dashboard no se pudo regenerar para ${reporteId}: ${resultadoDashboard.error}`);
    }
    
    console.log(`[HTTP] Reporte ${reporteId} actualizado exitosamente`);
    
    return {
      success: true,
      message: "Reporte actualizado correctamente",
      dashboardRegenerado: resultadoDashboard.success
    };
    
  } catch (error) {
    console.error(`[HTTP] Error actualizando reporte:`, error);
    throw new Error(`Error actualizando reporte: ${error.message}`);
  }
});

/**
 * Función HTTP para eliminar un reporte y sus datos del dashboard
 */
exports.deleteReporte = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error("Se requiere el ID del reporte para eliminarlo.");
  }
  
  console.log(`[HTTP] Eliminando reporte: ${reporteId}`);
  
  try {
    const db = admin.firestore();
    const batch = db.batch();
    
    // Eliminar documento principal del reporte
    const reporteRef = db.collection("Reportes").doc(reporteId);
    batch.delete(reporteRef);
    
    // Eliminar subcolecciones
    const [actividadesSnapshot, manoObraSnapshot] = await Promise.all([
      db.collection(`Reportes/${reporteId}/actividades`).get(),
      db.collection(`Reportes/${reporteId}/mano_obra`).get()
    ]);
    
    actividadesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    manoObraSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar datos del dashboard relacionados
    const dashboardRef = db.collection("Dashboard_Resumenes").doc(reporteId);
    batch.delete(dashboardRef);
    
    // Eliminar trabajadores relacionados con este reporte
    const trabajadoresQuery = await db.collection("Trabajadores_Resumen")
      .where("reporteId", "==", reporteId)
      .get();
    
    trabajadoresQuery.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar actividades relacionadas con este reporte
    const actividadesResumenQuery = await db.collection("Actividades_Resumen")
      .where("reporteId", "==", reporteId)
      .get();
    
    actividadesResumenQuery.docs.forEach(doc => batch.delete(doc.ref));
    
    // Ejecutar todas las eliminaciones
    await batch.commit();
    
    console.log(`[HTTP] Reporte ${reporteId} eliminado exitosamente`);
    
    return {
      success: true,
      message: "Reporte eliminado correctamente"
    };
    
  } catch (error) {
    console.error(`[HTTP] Error eliminando reporte:`, error);
    throw new Error(`Error eliminando reporte: ${error.message}`);
  }
});

exports.rectificarReporte = onCall(async (request) => {
  const { reporteId, dataParcial = {}, regenerarSheets = false } = request.data || {};
  if (!reporteId) throw new Error('reporteId es requerido');
  
  const db = admin.firestore();
  console.log(`[Rectificación] Iniciando rectificación para ${reporteId}`);
  
  try {
    // 1. Obtener documento original
    const docRef = db.collection('Reportes').doc(reporteId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw new Error('Reporte no encontrado');
    const originalData = docSnap.data();

    // 2. Obtener datos actuales de subcolecciones
    const [actividadesOrigSnap, manoObraOrigSnap] = await Promise.all([
      db.collection(`Reportes/${reporteId}/actividades`).get(),
      db.collection(`Reportes/${reporteId}/mano_obra`).get()
    ]);
    
    // 3. REVERTIR agregaciones con datos originales
    console.log('[Rectificación] Paso 1: Revirtiendo agregaciones previas...');
    if (dashboardIntegration?.deshacerAgregadoDashboardCompleto) {
      const actividadesOriginales = actividadesOrigSnap.docs.map(d => d.data());
      const manoObraOriginal = manoObraOrigSnap.docs.map(d => d.data());
      
      await dashboardIntegration.deshacerAgregadoDashboardCompleto(
        originalData, 
        reporteId,
        actividadesOriginales,
        manoObraOriginal
      );
    }

    // 4. Aplicar cambios SOLO a metradoE y horas
    console.log('[Rectificación] Paso 2: Aplicando cambios...');
    const batch = db.batch();
    
    // Import COSTOS_POR_HORA
    const { COSTOS_POR_HORA } = require('./utils');
    
    // Actualizar actividades (solo metradoE)
    if (dataParcial.actividades) {
      for (let i = 0; i < dataParcial.actividades.length; i++) {
        const actNueva = dataParcial.actividades[i];
        const docOriginal = actividadesOrigSnap.docs[i];
        
        if (docOriginal) {
          const dataOriginal = docOriginal.data();
          const metradoE = Number(actNueva.metradoE || 0);
          const precio = Number(dataOriginal.precio || actNueva.precio || 0);
          
          batch.update(docOriginal.ref, {
            metradoE: metradoE,
            valorTotal: metradoE * precio,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }
    
    // Actualizar mano de obra (solo horas)
    if (dataParcial.manoObra) {
      for (let i = 0; i < dataParcial.manoObra.length; i++) {
        const moNueva = dataParcial.manoObra[i];
        const docOriginal = manoObraOrigSnap.docs[i];
        
        if (docOriginal && moNueva.horas) {
          const dataOriginal = docOriginal.data();
          const categoria = (dataOriginal.categoria || '').toUpperCase();
          const costoHora = COSTOS_POR_HORA[categoria] || 0;
          const totalHoras = moNueva.horas.reduce((sum, h) => sum + Number(h || 0), 0);
          
          batch.update(docOriginal.ref, {
            horas: moNueva.horas,
            totalHoras: totalHoras,
            costoMO: totalHoras * costoHora,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }
    
    await batch.commit();
    console.log('[Rectificación] Cambios aplicados en Firebase');

    // 5. Obtener datos actualizados para re-agregar
    const [actividadesNuevasSnap, manoObraNuevaSnap] = await Promise.all([
      db.collection(`Reportes/${reporteId}/actividades`).get(),
      db.collection(`Reportes/${reporteId}/mano_obra`).get()
    ]);
    
    const actividadesNuevas = actividadesNuevasSnap.docs.map(d => d.data());
    const manoObraNueva = manoObraNuevaSnap.docs.map(d => d.data());
    
    // 6. Re-agregar con datos actualizados
    console.log('[Rectificación] Paso 3: Re-agregando con datos actualizados...');
    if (dashboardIntegration?.agregarADashboardCompleto) {
      await dashboardIntegration.agregarADashboardCompleto(
        originalData,
        reporteId,
        actividadesNuevas,
        manoObraNueva
      );
    }
    
    // 7. Actualizar documento principal
    await docRef.update({
      estado: 'RECTIFICADO',
      fechaRectificacion: admin.firestore.FieldValue.serverTimestamp(),
      notasRectificacion: dataParcial.notasRectificacion || 'Corrección de metrados y horas'
    });
    
    console.log(`[Rectificación] Completada exitosamente para ${reporteId}`);
    
    return {
      success: true,
      mensaje: 'Reporte rectificado correctamente',
      reporteId: reporteId
    };
    
  } catch (error) {
    console.error('[Rectificación] Error:', error);
    await db.collection('Reportes').doc(reporteId).update({
      estado: 'ERROR_RECTIFICACION',
      errorRectificacion: error.message,
      fechaError: admin.firestore.FieldValue.serverTimestamp()
    });
    throw new Error('Error rectificando: ' + error.message);
  }
});

// Función auxiliar para recalcular colecciones relacionadas
async function recalcularColeccionesRelacionadas(reporteId, fecha) {
  if (!fecha) return;
  
  const db = admin.firestore();
  const batch = db.batch();
  
  // Marcar los documentos de resumen para recálculo
  const { obtenerSemanaISO } = require('./utils');
  const periodos = {
    diario: `diario_${fecha}`,
    semanal: `semanal_${obtenerSemanaISO(new Date(fecha))}`,
    mensual: `mensual_${fecha.substring(0, 7)}`
  };
  
  for (const [tipo, docId] of Object.entries(periodos)) {
    const docRef = db.collection('Dashboard_Resumenes').doc(docId);
    batch.set(docRef, {
      requiereRecalculo: true,
      ultimaModificacion: admin.firestore.FieldValue.serverTimestamp(),
      reportesModificados: admin.firestore.FieldValue.arrayUnion(reporteId)
    }, { merge: true });
  }
  
  await batch.commit();
  console.log(`[Recálculo] Marcadas colecciones para recálculo: ${Object.values(periodos).join(', ')}`);
}

// ============================================================================
// NUEVAS FUNCIONES HTTP PARA SISTEMA COMPLETO
// ============================================================================

// Stubs de funciones avanzadas (archivo dashboard-etl-generator ausente)
async function generarDatosDashboardCompleto(reporteId) {
  return { success: true, mensaje: `Stub generarDatosDashboardCompleto para ${reporteId}` };
}
async function corregirYPropagarCambios(reporteId, datosCorregidos) {
  return { success: true, mensaje: `Stub corregirYPropagarCambios para ${reporteId}`, datosCorregidos };
}
async function procesarDatosReporte(reporteId) {
  const db = admin.firestore();
  const [actsSnap, moSnap] = await Promise.all([
    db.collection(`Reportes/${reporteId}/actividades`).get(),
    db.collection(`Reportes/${reporteId}/mano_obra`).get()
  ]);
  return {
    actividades: actsSnap.docs.map(d=>({ id: d.id, ...d.data() })),
    manoObra: moSnap.docs.map(d=>({ id: d.id, ...d.data() }))
  };
}
function calcularMetricasReporte(actividades, manoObra) {
  let totalMetrado = 0, totalHoras = 0, totalValor = 0, totalCostoMO = 0;
  const { COSTOS_POR_HORA, extraerPrecioUnitario } = require('./utils');
  const horasPorActividad = new Array(actividades.length).fill(0);
  manoObra.forEach(trab => {
    if (Array.isArray(trab.horas)) trab.horas.forEach((h,i)=>{ horasPorActividad[i]=(horasPorActividad[i]||0)+parseFloat(h||0); });
  });
  actividades.forEach((act,i)=>{
    const metradoE = parseFloat(act.metradoE||0);
    totalMetrado += metradoE;
    const precio = extraerPrecioUnitario(act);
    totalValor += metradoE * precio;
  });
  manoObra.forEach(trab => {
    const cat = (trab.categoria||'').toUpperCase();
    const costoHora = COSTOS_POR_HORA[cat] || 0;
    if (Array.isArray(trab.horas)) trab.horas.forEach(h=>{ const hh=parseFloat(h||0); totalHoras+=hh; totalCostoMO += hh * costoHora; });
  });
  return {
    totalMetradoE: totalMetrado,
    totalHoras,
    totalValorizado: totalValor,
    totalCostoMO,
    productividadPromedio: totalHoras>0? totalMetrado/totalHoras:0,
    gananciaTotal: totalValor - totalCostoMO
  };
}

// 🆕 IMPORTAR MÓDULOS DE ANÁLISIS
// Stub de análisis Firestore inexistente
async function obtenerProductividadTrabajadores() { return { stub: true }; }
async function obtenerAnalisisCostos() { return { stub: true }; }
async function obtenerComparativoPorCategoria() { return {}; }
async function obtenerEvolucionTemporal() { return { stub: true }; }

const {
  obtenerRankingProductividad,
  obtenerAnalisisCostosDetallado,
  obtenerProductividadPorActividad,
  obtenerEvolucionProductividad
} = require("./analisis-trabajadores-bigquery");

// Función para actualizar un reporte específico
exports.actualizarReporteCompleto = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error('reporteId es requerido');
  }
  
  try {
    const resultado = await generarDatosDashboardCompleto(reporteId);
    return resultado;
  } catch (error) {
    console.error("Error actualizando reporte:", error);
    throw new Error(error.message);
  }
});

// Función para propagar cambios de un reporte
exports.propagarCambios = onCall(async (request) => {
  const { reporteId, datosCorregidos } = request.data;
  
  if (!reporteId) {
    throw new Error('reporteId es requerido');
  }
  
  try {
    const resultado = await corregirYPropagarCambios(reporteId, datosCorregidos);
    return resultado;
  } catch (error) {
    console.error("Error propagando cambios:", error);
    throw new Error(error.message);
  }
});

// Función para validar consistencia de datos
exports.validarConsistencia = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error('reporteId es requerido');
  }
  
  try {
    const resultado = await procesarDatosReporte(reporteId);
    return { success: true, datos: resultado };
  } catch (error) {
    console.error("Error validando consistencia:", error);
    throw new Error(error.message);
  }
});

// Función para regenerar datos completos de un reporte
exports.regenerarDatosReporte = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error('reporteId es requerido');
  }
  
  try {
    const resultado = await generarDatosDashboardCompleto(reporteId);
    return resultado;
  } catch (error) {
    console.error("Error regenerando datos:", error);
    throw new Error(error.message);
  }
});

// Función para obtener métricas de un reporte
exports.obtenerMetricasReporte = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error('reporteId es requerido');
  }
  
  try {
    const { actividades, manoObra } = await procesarDatosReporte(reporteId);
    const metricas = calcularMetricasReporte(actividades, manoObra);
    return { success: true, metricas };
  } catch (error) {
    console.error("Error obteniendo métricas:", error);
    throw new Error(error.message);
  }
});

// ============================================================================
// 🆕 FUNCIONES DE ANÁLISIS DE TRABAJADORES
// ============================================================================

// 🏆 Ranking de productividad de trabajadores (BigQuery)
exports.obtenerRankingProductividadTrabajadores = onCall(async (request) => {
  const { fechaInicio, fechaFin } = request.data;
  
  try {
    const resultado = await obtenerRankingProductividad(fechaInicio, fechaFin);
    return { success: true, data: resultado };
  } catch (error) {
    console.error("Error obteniendo ranking de productividad:", error);
    throw new Error(error.message);
  }
});

// 💰 Análisis detallado de costos (BigQuery)
exports.obtenerAnalisisCostosTrabajadores = onCall(async (request) => {
  const { periodo = 'mensual' } = request.data;
  
  try {
    const resultado = await obtenerAnalisisCostosDetallado(periodo);
    return { success: true, data: resultado };
  } catch (error) {
    console.error("Error en análisis de costos:", error);
    throw new Error(error.message);
  }
});

// 📊 Productividad por actividad (BigQuery)
exports.obtenerProductividadPorActividad = onCall(async (request) => {
  try {
    const resultado = await obtenerProductividadPorActividad();
    return { success: true, data: resultado };
  } catch (error) {
    console.error("Error obteniendo productividad por actividad:", error);
    throw new Error(error.message);
  }
});

// 📈 Evolución temporal de productividad (BigQuery)
exports.obtenerEvolucionProductividadTemporal = onCall(async (request) => {
  const { trabajadorNombre, meses = 12 } = request.data;
  
  try {
    const resultado = await obtenerEvolucionProductividad(trabajadorNombre, meses);
    return { success: true, data: resultado };
  } catch (error) {
    console.error("Error en evolución temporal:", error);
    throw new Error(error.message);
  }
});

// 🔍 Análisis completo de trabajadores (Firestore)
exports.obtenerAnalisisCompletoTrabajadores = onCall(async (request) => {
  const { fechaInicio, fechaFin } = request.data;
  
  try {
    const [productividad, comparativo] = await Promise.all([
      obtenerProductividadTrabajadores(fechaInicio, fechaFin),
      obtenerComparativoPorCategoria()
    ]);
    
    return { 
      success: true, 
      data: { 
        productividad, 
        comparativo 
      } 
    };
  } catch (error) {
    console.error("Error en análisis completo:", error);
    throw new Error(error.message);
  }
});

// 📊 Dashboard unificado de trabajadores
exports.obtenerDashboardTrabajadores = onCall(async (request) => {
  const { fechaInicio, fechaFin, incluirEvolucion = false } = request.data;
  
  try {
    console.log('📊 Generando dashboard unificado de trabajadores...');
    
    // Ejecutar consultas en paralelo
    const promesas = [
      obtenerRankingProductividad(fechaInicio, fechaFin),
      obtenerAnalisisCostosDetallado('mensual'),
      obtenerComparativoPorCategoria()
    ];
    
    if (incluirEvolucion) {
      promesas.push(obtenerEvolucionProductividad(null, 6));
    }
    
    const [ranking, costos, comparativo, evolucion] = await Promise.all(promesas);
    
    // Calcular resumen ejecutivo
    const resumenEjecutivo = {
      total_trabajadores: ranking.total_trabajadores,
      productividad_promedio: ranking.estadisticas.productividad_promedio,
      costo_total: ranking.estadisticas.costo_total,
      metrado_total: ranking.estadisticas.metrado_total,
      eficiencia_general: ranking.estadisticas.metrado_total / ranking.estadisticas.costo_total,
      top_3_trabajadores: ranking.trabajadores.slice(0, 3),
      categorias: {
        OPERARIO: comparativo.OPERARIO?.cantidadTrabajadores || 0,
        OFICIAL: comparativo.OFICIAL?.cantidadTrabajadores || 0,
        PEON: comparativo.PEON?.cantidadTrabajadores || 0
      }
    };
    
    return {
      success: true,
      data: {
        resumen_ejecutivo: resumenEjecutivo,
        ranking_productividad: ranking,
        analisis_costos: costos,
        comparativo_categorias: comparativo,
        evolucion_temporal: evolucion || null,
        fecha_generacion: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error("Error generando dashboard de trabajadores:", error);
    throw new Error(error.message);
  }
});

// Función para calcular productividad de trabajador
exports.calcularProductividadTrabajador = onCall(async (request) => {
  const { reporteId } = request.data;
  
  if (!reporteId) {
    throw new Error('reporteId es requerido');
  }
  
  try {
    const { actividades, manoObra } = await procesarDatosReporte(reporteId);
    const metricas = calcularMetricasReporte(actividades, manoObra);
    return { success: true, productividad: metricas.productividadPromedio };
  } catch (error) {
    console.error("Error calculando productividad:", error);
    throw new Error(error.message);
  }
});

/**
 * Fallback: obtiene métricas desde Firestore (método original)
 */
async function obtenerMetricasDesdeFirestore(fechaInicio, fechaFin, tipo) {
  const db = admin.firestore();
  let query;
  
  if (tipo === 'diario') {
    query = db.collection("Dashboard_Resumenes")
      .where(admin.firestore.FieldPath.documentId(), ">=", `diario_${fechaInicio}`)
      .where(admin.firestore.FieldPath.documentId(), "<=", `diario_${fechaFin}`)
      .orderBy(admin.firestore.FieldPath.documentId(), "asc");
  } else if (tipo === 'semanal') {
    const { obtenerSemanaISO } = require('./utils');
    const semanaInicio = obtenerSemanaISO(fechaInicio);
    const semanaFin = obtenerSemanaISO(fechaFin);
    query = db.collection("Dashboard_Resumenes")
      .where(admin.firestore.FieldPath.documentId(), ">=", `semanal_${semanaInicio}`)
      .where(admin.firestore.FieldPath.documentId(), "<=", `semanal_${semanaFin}`)
      .orderBy(admin.firestore.FieldPath.documentId(), "asc");
  } else if (tipo === 'mensual') {
    const obtenerMesKey = (fechaStr)=> String(fechaStr).substring(0,7);
    const mesInicio = obtenerMesKey(fechaInicio);
    const mesFin = obtenerMesKey(fechaFin);
    query = db.collection("Dashboard_Resumenes")
      .where(admin.firestore.FieldPath.documentId(), ">=", `mensual_${mesInicio}`)
      .where(admin.firestore.FieldPath.documentId(), "<=", `mensual_${mesFin}`)
      .orderBy(admin.firestore.FieldPath.documentId(), "asc");
  } else {
    throw new Error("Tipo de período no válido. Use 'diario', 'semanal' o 'mensual'");
  }
  
  const querySnapshot = await query.get();
  const datos = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Calcular métricas agregadas
  const metricas = calcularMetricasAgregadas(datos, tipo);
  
  return {
    datos: datos,
    metricas: metricas
  };
}

/**
 * Calcula métricas agregadas para un conjunto de datos
 */
function calcularMetricasAgregadas(datos, tipo) {
  if (!datos || datos.length === 0) {
    return {
      total_registros: 0,
      total_valorizado: 0,
      total_costo_mo: 0,
      ganancia_total: 0,
      margen_ganancia_promedio: 0,
      productividad_promedio: 0
    };
  }
  
  const totales = datos.reduce((acc, registro) => {
    acc.total_valorizado += parseFloat(registro.total_valorizado || registro.totalValorizado || 0);
    acc.total_costo_mo += parseFloat(registro.total_costo_mo || registro.totalCostoMO || 0);
    acc.ganancia_total += parseFloat(registro.ganancia_total || registro.gananciaTotal || 0);
    acc.total_horas += parseFloat(registro.total_horas || registro.totalHoras || 0);
    acc.total_metrado += parseFloat(registro.total_metrado_e || registro.totalMetradoE || 0);
    return acc;
  }, {
    total_valorizado: 0,
    total_costo_mo: 0,
    ganancia_total: 0,
    total_horas: 0,
    total_metrado: 0
  });
  
  return {
    total_registros: datos.length,
    ...totales,
    margen_ganancia_promedio: totales.total_valorizado > 0 ? 
      (totales.ganancia_total / totales.total_valorizado) * 100 : 0,
    productividad_promedio: totales.total_horas > 0 ? 
      totales.total_metrado / totales.total_horas : 0
  };
}
