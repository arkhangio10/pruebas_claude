const admin = require('firebase-admin');
const { COSTOS_POR_HORA, extraerPrecioUnitario, sanitizarId, obtenerSemanaISO } = require('./utils');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// ----------------------------------------------------------
// Helpers / Constantes para rutas de campos (evita typos)
// ----------------------------------------------------------
const actividadAcumulado = {
    metrado: 'acumulado.metrado',
    horas: 'acumulado.horas',
    costoMO: 'acumulado.costoMO',
    valor: 'acumulado.valor',
    costoOperario: 'acumulado.costoOperario',
    costoOficial: 'acumulado.costoOficial',
    costoPeon: 'acumulado.costoPeon',
    horasOperario: 'acumulado.horasOperario',
    horasOficial: 'acumulado.horasOficial',
    horasPeon: 'acumulado.horasPeon'
};

function pathActividad(periodoTipo, periodoValor, campo) {
    return `periodos.${periodoTipo}.${periodoValor}.${campo}`;
}

const trabajadorResumen = {
    metrado: 'resumen.metrado',
    horas: 'resumen.horas',
    costoMO: 'resumen.costoMO',
    totalProduccion: {
        horas: 'resumen.totalProduccion.horas',
        costo: 'resumen.totalProduccion.costo',
        productividadMedia: 'resumen.totalProduccion.productividadMedia'
    },
    datos: {
        nombre: 'datos.nombre',
        categoria: 'datos.categoria',
        ultimaActividad: 'datos.ultimaActividad'
    }
};

function pathTrabajador(periodoTipo, periodoValor, campo) {
    return `periodos.${periodoTipo}.${periodoValor}.${campo}`;
}

// ----------------------------------------------------------
// Consolidación de datos de un reporte
// ----------------------------------------------------------
function consolidarDatosReporte(actividades, manoObra) {
    // NUEVA VALIDACIÓN ESTRICTA
    console.log('[Consolidación] Iniciando con:', {
        numActividades: actividades?.length,
        numManoObra: manoObra?.length
    });
    
    if (!Array.isArray(actividades) || !Array.isArray(manoObra)) {
        throw new Error('Datos de actividades o mano de obra no son arrays válidos.');
    }
    
    // Validar estructura de horas
    let horasValidas = true;
    manoObra.forEach((trab, idx) => {
        if (!trab.horas) {
            console.warn(`[Consolidación] Trabajador ${idx} sin horas, creando array vacío`);
            trab.horas = new Array(actividades.length).fill(0);
        } else if (!Array.isArray(trab.horas)) {
            console.error(`[Consolidación] Trabajador ${idx} con horas inválidas:`, trab.horas);
            horasValidas = false;
        } else if (trab.horas.length !== actividades.length) {
            console.warn(`[Consolidación] Trabajador ${idx}: ${trab.horas.length} horas vs ${actividades.length} actividades`);
        }
    });
    
    if (!horasValidas) {
        throw new Error('Estructura de horas inválida en mano de obra');
    }

    const actividadesMap = new Map();
    const trabajadoresMap = new Map();
    let costoTotalReporte = 0;
    let valorTotalReporte = 0;
    let horasTotalesReporte = 0;

    manoObra.forEach(trab => {
        if (Array.isArray(trab.horas) && trab.horas.length !== actividades.length) {
            throw new Error(`Inconsistencia de datos: El trabajador ${trab.trabajador || trab.id} tiene ${trab.horas.length} registros de horas, pero hay ${actividades.length} actividades.`);
        }
    });

    const horasTotalesPorActividad = new Array(actividades.length).fill(0);
    manoObra.forEach(trab => {
        if (Array.isArray(trab.horas)) {
            trab.horas.forEach((h, index) => {
                if (index < horasTotalesPorActividad.length) {
                    horasTotalesPorActividad[index] += parseFloat(h || 0);
                }
            });
        }
    });

    actividades.forEach((act, index) => {
        const metrado = parseFloat(act.metradoE || 0);
        const precio = extraerPrecioUnitario(act);
        const valor = metrado * precio;
        const actividadId = sanitizarId(act.proceso || act.nombre);

        actividadesMap.set(actividadId, {
            nombre: act.proceso || act.nombre || 'Actividad sin nombre',
            unidad: act.unidad || act.und || 'UND',
            metrado,
            valor,
            horas: horasTotalesPorActividad[index],
            costoMO: 0,
            costoOperario: 0,
            costoOficial: 0,
            costoPeon: 0,
            horasOperario: 0,
            horasOficial: 0,
            horasPeon: 0
        });
        valorTotalReporte += valor;
    });

    manoObra.forEach(trab => {
        const categoria = trab.categoria?.toUpperCase() || 'SIN CATEGORÍA';
        const costoHora = COSTOS_POR_HORA[categoria] || 0;
        const trabajadorId = trab.dni || sanitizarId(trab.trabajador || trab.nombre);

        if (!trabajadoresMap.has(trabajadorId)) {
            trabajadoresMap.set(trabajadorId, {
                nombre: trab.trabajador || trab.nombre || 'Trabajador sin nombre',
                categoria,
                horas: 0,
                costoMO: 0,
                metrado: 0
            });
        }

        const horasArray = Array.isArray(trab.horas) ? trab.horas : [];
        horasArray.forEach((h, index) => {
            const horasTrabajadorActividad = parseFloat(h || 0);
            if (horasTrabajadorActividad > 0 && index < actividades.length) {
                const costoHoras = horasTrabajadorActividad * costoHora;
                const actId = sanitizarId(actividades[index].proceso || actividades[index].nombre);

                const metradoActividad = parseFloat(actividades[index].metradoE || 0);
                const totalHorasActividad = horasTotalesPorActividad[index];
                let metradoAtribuido = 0;
                if (totalHorasActividad > 0) {
                    metradoAtribuido = metradoActividad * (horasTrabajadorActividad / totalHorasActividad);
                }

                if (actividadesMap.has(actId)) {
                    const actMap = actividadesMap.get(actId);
                    actMap.costoMO += costoHoras;
                    if (categoria === 'OPERARIO') {
                        actMap.costoOperario += costoHoras;
                        actMap.horasOperario += horasTrabajadorActividad;
                    } else if (categoria === 'OFICIAL') {
                        actMap.costoOficial += costoHoras;
                        actMap.horasOficial += horasTrabajadorActividad;
                    } else if (categoria === 'PEON') {
                        actMap.costoPeon += costoHoras;
                        actMap.horasPeon += horasTrabajadorActividad;
                    }
                }

                const trabMap = trabajadoresMap.get(trabajadorId);
                trabMap.horas += horasTrabajadorActividad;
                trabMap.costoMO += costoHoras;
                trabMap.metrado += metradoAtribuido;

                horasTotalesReporte += horasTrabajadorActividad;
                costoTotalReporte += costoHoras;
            }
        });
    });

    return { actividadesMap, trabajadoresMap, costoTotalReporte, valorTotalReporte, horasTotalesReporte };
}

// ----------------------------------------------------------
// Actualizaciones Firestore
// ----------------------------------------------------------
function actualizarResumenesGenerales(batch, datosReporte, periodos, reporteId, factor = 1) {
    const { costoTotalReporte, valorTotalReporte, horasTotalesReporte, trabajadoresMap } = datosReporte;
    const ids = [
        `diario_${periodos.periodoDiario}`,
        `semanal_${periodos.periodoSemanal}`,
        `mensual_${periodos.periodoMensual}`
    ];

    ids.forEach(docId => {
        const docRef = db.collection('Dashboard_Resumenes').doc(docId);

        const datosBase = {
            periodo: docId.startsWith('diario') ? 'diario' : docId.startsWith('semanal') ? 'semanal' : 'mensual',
            fecha: periodos.periodoDiario,
            ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };

        const update = {
            ...datosBase,
            'metricas.costoTotal': admin.firestore.FieldValue.increment(costoTotalReporte * factor),
            'metricas.valorTotal': admin.firestore.FieldValue.increment(valorTotalReporte * factor),
            'metricas.ganancia': admin.firestore.FieldValue.increment((valorTotalReporte - costoTotalReporte) * factor),
            'metricas.totalHoras': admin.firestore.FieldValue.increment(horasTotalesReporte * factor),
            'metricas.cantidadReportes': admin.firestore.FieldValue.increment(1 * factor),
            'metricas.cantidadTrabajadores': admin.firestore.FieldValue.increment(trabajadoresMap.size * factor),
            'metricas.reportesProcesados': admin.firestore.FieldValue.increment(1 * factor)
        };

    // Reemplazo de arrayUnion para evitar crecimiento ilimitado: contador simple
    update['metricas.conteoReportesIds'] = admin.firestore.FieldValue.increment(1 * factor);

        batch.set(docRef, update, { merge: true });
    });
}

function actualizarResumenesPorActividad(batch, actividadesMap, periodos, factor = 1) {
    const { periodoDiario, periodoSemanal, periodoMensual } = periodos;

    for (const [actividadId, data] of actividadesMap.entries()) {
        const docRef = db.collection('Actividades_Resumen').doc(actividadId);

        const update = {
            nombre: data.nombre,
            unidad: data.unidad,
            ultimaActualizacion: periodoDiario,

            [actividadAcumulado.metrado]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [actividadAcumulado.horas]: admin.firestore.FieldValue.increment(data.horas * factor),
            [actividadAcumulado.costoMO]: admin.firestore.FieldValue.increment(data.costoMO * factor),
            [actividadAcumulado.valor]: admin.firestore.FieldValue.increment(data.valor * factor),
            [actividadAcumulado.costoOperario]: admin.firestore.FieldValue.increment(data.costoOperario * factor),
            [actividadAcumulado.costoOficial]: admin.firestore.FieldValue.increment(data.costoOficial * factor),
            [actividadAcumulado.costoPeon]: admin.firestore.FieldValue.increment(data.costoPeon * factor),
            [actividadAcumulado.horasOperario]: admin.firestore.FieldValue.increment(data.horasOperario * factor),
            [actividadAcumulado.horasOficial]: admin.firestore.FieldValue.increment(data.horasOficial * factor),
            [actividadAcumulado.horasPeon]: admin.firestore.FieldValue.increment(data.horasPeon * factor),

            // Diario
            [pathActividad('diario', periodoDiario, 'metrado')]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [pathActividad('diario', periodoDiario, 'horas')]: admin.firestore.FieldValue.increment(data.horas * factor),
            [pathActividad('diario', periodoDiario, 'valor')]: admin.firestore.FieldValue.increment(data.valor * factor),
            [pathActividad('diario', periodoDiario, 'costoMO')]: admin.firestore.FieldValue.increment(data.costoMO * factor),
            [pathActividad('diario', periodoDiario, 'costoOperario')]: admin.firestore.FieldValue.increment(data.costoOperario * factor),
            [pathActividad('diario', periodoDiario, 'costoOficial')]: admin.firestore.FieldValue.increment(data.costoOficial * factor),
            [pathActividad('diario', periodoDiario, 'costoPeon')]: admin.firestore.FieldValue.increment(data.costoPeon * factor),
            [pathActividad('diario', periodoDiario, 'horasOperario')]: admin.firestore.FieldValue.increment(data.horasOperario * factor),
            [pathActividad('diario', periodoDiario, 'horasOficial')]: admin.firestore.FieldValue.increment(data.horasOficial * factor),
            [pathActividad('diario', periodoDiario, 'horasPeon')]: admin.firestore.FieldValue.increment(data.horasPeon * factor),

            // Semanal
            [pathActividad('semanal', periodoSemanal, 'metrado')]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [pathActividad('semanal', periodoSemanal, 'horas')]: admin.firestore.FieldValue.increment(data.horas * factor),
            [pathActividad('semanal', periodoSemanal, 'valor')]: admin.firestore.FieldValue.increment(data.valor * factor),
            [pathActividad('semanal', periodoSemanal, 'costoMO')]: admin.firestore.FieldValue.increment(data.costoMO * factor),
            [pathActividad('semanal', periodoSemanal, 'costoOperario')]: admin.firestore.FieldValue.increment(data.costoOperario * factor),
            [pathActividad('semanal', periodoSemanal, 'costoOficial')]: admin.firestore.FieldValue.increment(data.costoOficial * factor),
            [pathActividad('semanal', periodoSemanal, 'costoPeon')]: admin.firestore.FieldValue.increment(data.costoPeon * factor),
            [pathActividad('semanal', periodoSemanal, 'horasOperario')]: admin.firestore.FieldValue.increment(data.horasOperario * factor),
            [pathActividad('semanal', periodoSemanal, 'horasOficial')]: admin.firestore.FieldValue.increment(data.horasOficial * factor),
            [pathActividad('semanal', periodoSemanal, 'horasPeon')]: admin.firestore.FieldValue.increment(data.horasPeon * factor),

            // Mensual
            [pathActividad('mensual', periodoMensual, 'metrado')]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [pathActividad('mensual', periodoMensual, 'horas')]: admin.firestore.FieldValue.increment(data.horas * factor),
            [pathActividad('mensual', periodoMensual, 'valor')]: admin.firestore.FieldValue.increment(data.valor * factor),
            [pathActividad('mensual', periodoMensual, 'costoMO')]: admin.firestore.FieldValue.increment(data.costoMO * factor),
            [pathActividad('mensual', periodoMensual, 'costoOperario')]: admin.firestore.FieldValue.increment(data.costoOperario * factor),
            [pathActividad('mensual', periodoMensual, 'costoOficial')]: admin.firestore.FieldValue.increment(data.costoOficial * factor),
            [pathActividad('mensual', periodoMensual, 'costoPeon')]: admin.firestore.FieldValue.increment(data.costoPeon * factor),
            [pathActividad('mensual', periodoMensual, 'horasOperario')]: admin.firestore.FieldValue.increment(data.horasOperario * factor),
            [pathActividad('mensual', periodoMensual, 'horasOficial')]: admin.firestore.FieldValue.increment(data.horasOficial * factor),
            [pathActividad('mensual', periodoMensual, 'horasPeon')]: admin.firestore.FieldValue.increment(data.horasPeon * factor)
        };

        batch.set(docRef, update, { merge: true });
    }
}

function actualizarResumenesPorTrabajador(batch, trabajadoresMap, periodos, factor = 1) {
    const { periodoDiario, periodoSemanal, periodoMensual } = periodos;

    for (const [trabajadorId, data] of trabajadoresMap.entries()) {
        const docRef = db.collection('Trabajadores_Resumen').doc(trabajadorId);
        const productividadMedia = data.horas > 0 ? data.costoMO / data.horas : 0;

        const update = {
            nombre: data.nombre,
            categoria: data.categoria,
            ultimaActividad: periodoDiario,

            [trabajadorResumen.datos.nombre]: data.nombre,
            [trabajadorResumen.datos.categoria]: data.categoria,
            [trabajadorResumen.datos.ultimaActividad]: periodoDiario,

            [trabajadorResumen.metrado]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [pathTrabajador('diario', periodoDiario, 'metrado')]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [pathTrabajador('semanal', periodoSemanal, 'metrado')]: admin.firestore.FieldValue.increment(data.metrado * factor),
            [pathTrabajador('mensual', periodoMensual, 'metrado')]: admin.firestore.FieldValue.increment(data.metrado * factor),

            [trabajadorResumen.horas]: admin.firestore.FieldValue.increment(data.horas * factor),
            [trabajadorResumen.costoMO]: admin.firestore.FieldValue.increment(data.costoMO * factor),
            [trabajadorResumen.totalProduccion.horas]: admin.firestore.FieldValue.increment(data.horas * factor),
            [trabajadorResumen.totalProduccion.costo]: admin.firestore.FieldValue.increment(data.costoMO * factor),
            [trabajadorResumen.totalProduccion.productividadMedia]: productividadMedia,

            [pathTrabajador('diario', periodoDiario, 'horas')]: admin.firestore.FieldValue.increment(data.horas * factor),
            [pathTrabajador('diario', periodoDiario, 'costoMO')]: admin.firestore.FieldValue.increment(data.costoMO * factor),

            [pathTrabajador('semanal', periodoSemanal, 'horas')]: admin.firestore.FieldValue.increment(data.horas * factor),
            [pathTrabajador('semanal', periodoSemanal, 'costoMO')]: admin.firestore.FieldValue.increment(data.costoMO * factor),

            [pathTrabajador('mensual', periodoMensual, 'horas')]: admin.firestore.FieldValue.increment(data.horas * factor),
            [pathTrabajador('mensual', periodoMensual, 'costoMO')]: admin.firestore.FieldValue.increment(data.costoMO * factor)
        };

        batch.set(docRef, update, { merge: true });
    }
}

function registrarEnlaceReporte(batch, reporteData, reporteId, datosConsolidados) {
    const docRef = db.collection('Reportes_Links').doc(reporteId);
    const linkData = {
        reporteId,
        fecha: reporteData.fecha || new Date().toISOString().split('T')[0],
        creadoPor: reporteData.creadoPor || reporteData.elaboradoPor || 'Sistema',
        subcontratistaBLoque: reporteData.subcontratistaBLoque || reporteData.subcontratistaBloque || 'N/A',
        totalValorizado: datosConsolidados.valorTotalReporte || 0,
        totalActividades: datosConsolidados.actividadesMap?.size || 0,
        totalTrabajadores: datosConsolidados.trabajadoresMap?.size || 0,
        enlaceSheet: reporteData.spreadsheetUrl || reporteData.enlaceSheet || '',
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };
    batch.set(docRef, linkData, { merge: true });
}

// ----------------------------------------------------------
// Operaciones principales
// ----------------------------------------------------------
async function agregarADashboard(reporteData, reporteId) {
    console.log(`[Agregación] Iniciando para reporte: ${reporteId}`);
    if (!reporteData || !reporteId) {
        throw new Error('Datos de reporte o ID faltantes para la agregación.');
    }
    const fecha = reporteData.fecha;
    if (!fecha || isNaN(new Date(fecha).getTime())) {
        throw new Error(`[Agregación] Fecha inválida en el reporte: ${fecha}`);
    }
    const fechaObj = new Date(fecha);
    const periodos = {
        periodoDiario: fecha,
        periodoSemanal: obtenerSemanaISO(fechaObj),
        periodoMensual: fecha.substring(0, 7)
    };

    const [actividadesSnapshot, manoObraSnapshot] = await Promise.all([
        db.collection(`Reportes/${reporteId}/actividades`).get(),
        db.collection(`Reportes/${reporteId}/mano_obra`).get()
    ]);
    const actividades = actividadesSnapshot.docs.map(doc => doc.data());
    const manoObra = manoObraSnapshot.docs.map(doc => doc.data());
    const datosReporte = consolidarDatosReporte(actividades, manoObra);

    const batch = db.batch();
    actualizarResumenesGenerales(batch, datosReporte, periodos, reporteId);
    actualizarResumenesPorActividad(batch, datosReporte.actividadesMap, periodos);
    actualizarResumenesPorTrabajador(batch, datosReporte.trabajadoresMap, periodos);
    registrarEnlaceReporte(batch, reporteData, reporteId, datosReporte);

    await batch.commit();
    console.log(`[Agregación] Reporte ${reporteId} sumado a los resúmenes exitosamente.`);
    return { success: true, message: `Reporte ${reporteId} agregado exitosamente.` };
}

async function deshacerAgregadoDashboard(reporteData, reporteId) {
    console.log(`[Reversión] Iniciando para reporte: ${reporteId}`);
    if (!reporteData || !reporteId) {
        throw new Error('Datos de reporte o ID faltantes para la reversión.');
    }
    const fecha = reporteData.fecha;
    if (!fecha || isNaN(new Date(fecha).getTime())) {
        throw new Error(`[Reversión] Fecha inválida en el reporte a revertir: ${fecha}. No se puede continuar.`);
    }
    const fechaObj = new Date(fecha);
    const periodos = {
        periodoDiario: fecha,
        periodoSemanal: obtenerSemanaISO(fechaObj),
        periodoMensual: fecha.substring(0, 7)
    };

    const [actividadesSnapshot, manoObraSnapshot] = await Promise.all([
        db.collection(`Reportes/${reporteId}/actividades`).get(),
        db.collection(`Reportes/${reporteId}/mano_obra`).get()
    ]);

    if (actividadesSnapshot.empty && manoObraSnapshot.empty) {
        console.warn(`[Reversión] No se encontraron subcolecciones para ${reporteId}. Se revertirá solo el conteo de reportes.`);
        const batch = db.batch();
        const factorReversion = -1;
    const datosSimulados = { costoTotalReporte: 0, valorTotalReporte: 0, horasTotalesReporte: 0, trabajadoresMap: new Map() };
        actualizarResumenesGenerales(batch, datosSimulados, periodos, reporteId, factorReversion);
        await batch.commit();
        return { success: true, message: 'Conteo de reportes revertido.' };
    }

    const actividades = actividadesSnapshot.docs.map(doc => doc.data());
    const manoObra = manoObraSnapshot.docs.map(doc => doc.data());
    const datosReporte = consolidarDatosReporte(actividades, manoObra);

    const batch = db.batch();
    const factorReversion = -1;
    actualizarResumenesGenerales(batch, datosReporte, periodos, reporteId, factorReversion);
    actualizarResumenesPorActividad(batch, datosReporte.actividadesMap, periodos, factorReversion);
    actualizarResumenesPorTrabajador(batch, datosReporte.trabajadoresMap, periodos, factorReversion);
    const linkRef = db.collection('Reportes_Links').doc(reporteId);
    batch.delete(linkRef);
    await batch.commit();
    console.log(`[Reversión] Contribuciones del reporte ${reporteId} eliminadas exitosamente.`);
    return { success: true, message: `Contribuciones del reporte ${reporteId} revertidas.` };
}

async function limpiarDashboard() {
    try {
        console.log('[Limpieza] Iniciando limpieza del dashboard...');
        console.log('[Limpieza] Función de limpieza disponible pero no implementada');
        return { success: true, message: 'Función de limpieza disponible' };
    } catch (error) {
        console.error('[Limpieza] Error en limpieza:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Versión mejorada para deshacer agregados con datos completos de actividades y mano de obra
 * Esto mejora la precisión de la reversión
 */
async function deshacerAgregadoDashboardCompleto(reporteData, reporteId, actividades, manoObra) {
    try {
        console.log(`[Reversión Completa] Iniciando para reporte: ${reporteId}`);
  
        const fecha = reporteData.fecha;
        const fechaObj = new Date(fecha);
        const periodos = {
            periodoDiario: fecha,
            periodoSemanal: obtenerSemanaISO(fechaObj),
            periodoMensual: fecha.substring(0, 7)
        };
  
        // Consolidar datos originales completos
        const datosOriginales = consolidarDatosReporte(actividades, manoObra);
  
        const batch = db.batch();
        const factorReversion = -1;
  
        // Revertir todas las agregaciones con datos precisos
        actualizarResumenesGenerales(batch, datosOriginales, periodos, reporteId, factorReversion);
        actualizarResumenesPorActividad(batch, datosOriginales.actividadesMap, periodos, factorReversion);
        actualizarResumenesPorTrabajador(batch, datosOriginales.trabajadoresMap, periodos, factorReversion);
  
        // Eliminar enlace
        const linkRef = db.collection('Reportes_Links').doc(reporteId);
        batch.delete(linkRef);
  
        await batch.commit();
        console.log(`[Reversión Completa] Completada para ${reporteId}`);
        return { success: true };
    } catch (error) {
        console.error(`[Reversión Completa] Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Versión mejorada para agregar con datos completos de actividades y mano de obra
 * Esto permite agregar con mayor precisión al dashboard
 */
async function agregarADashboardCompleto(reporteData, reporteId, actividades, manoObra) {
    try {
        console.log(`[Agregación Completa] Iniciando para reporte: ${reporteId}`);
        console.log('[Agregación Completa] Datos recibidos:', {
            reporteId,
            fecha: reporteData.fecha,
            numActividades: actividades?.length,
            numTrabajadores: manoObra?.length,
            primeraActividad: {
                proceso: actividades?.[0]?.proceso,
                metradoE: actividades?.[0]?.metradoE,
                precio: actividades?.[0]?.precio
            },
            primerTrabajador: {
                nombre: manoObra?.[0]?.trabajador,
                horas: manoObra?.[0]?.horas?.length,
                categoria: manoObra?.[0]?.categoria
            }
        });
        
        // VALIDACIÓN DE ESTRUCTURA
        if (!actividades || !Array.isArray(actividades)) {
            throw new Error('Actividades inválidas o faltantes');
        }
        
        if (!manoObra || !Array.isArray(manoObra)) {
            throw new Error('Mano de obra inválida o faltante');
        }
  
        const fecha = reporteData.fecha;
        const fechaObj = new Date(fecha);
        const periodos = {
            periodoDiario: fecha,
            periodoSemanal: obtenerSemanaISO(fechaObj),
            periodoMensual: fecha.substring(0, 7)
        };
  
        // Consolidar datos nuevos
        const datosNuevos = consolidarDatosReporte(actividades, manoObra);
  
        const batch = db.batch();
  
        // Agregar todas las agregaciones con datos nuevos
        actualizarResumenesGenerales(batch, datosNuevos, periodos, reporteId);
        actualizarResumenesPorActividad(batch, datosNuevos.actividadesMap, periodos);
        actualizarResumenesPorTrabajador(batch, datosNuevos.trabajadoresMap, periodos);
        registrarEnlaceReporte(batch, reporteData, reporteId, datosNuevos);
  
        await batch.commit();
        console.log(`[Agregación Completa] Completada para ${reporteId}`);
        return { success: true };
    } catch (error) {
        console.error(`[Agregación Completa] Error detallado:`, {
            mensaje: error.message,
            stack: error.stack,
            reporteId,
            datosRecibidos: {
                actividades: actividades?.length,
                manoObra: manoObra?.length
            }
        });
        return { success: false, error: error.message };
    }
}

/**
 * Función para recalcular completamente las agregaciones de un reporte
 * Útil para rectificaciones donde se necesita garantizar consistencia total
 */
async function recalcularAgregadosCompletos(reporteId) {
    console.log(`[Recálculo Completo] Iniciando para reporte ${reporteId}`);
    
    try {
        // 1. Obtener el reporte actualizado con sus subcolecciones
        const reporteRef = db.collection('Reportes').doc(reporteId);
        const reporteSnap = await reporteRef.get();
        
        if (!reporteSnap.exists) {
            throw new Error(`Reporte ${reporteId} no encontrado`);
        }
        
        const reporteData = reporteSnap.data();
        
        // 2. Obtener las subcolecciones actualizadas
        const [actividadesSnap, manoObraSnap] = await Promise.all([
            db.collection(`Reportes/${reporteId}/actividades`).get(),
            db.collection(`Reportes/${reporteId}/mano_obra`).get()
        ]);
        
        const actividades = actividadesSnap.docs.map(doc => doc.data());
        const manoObra = manoObraSnap.docs.map(doc => doc.data());
        
        // 3. Primero, revertir completamente las contribuciones anteriores
        console.log('[Recálculo] Paso 1: Revirtiendo agregaciones anteriores...');
        const reversionResult = await deshacerAgregadoDashboardCompleto(
            reporteData, 
            reporteId, 
            actividades, 
            manoObra
        );
        
        if (!reversionResult.success) {
            throw new Error('Fallo al revertir agregaciones anteriores');
        }
        
        // 4. Esperar un momento para asegurar propagación
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 5. Volver a agregar con los datos actuales
        console.log('[Recálculo] Paso 2: Aplicando nuevas agregaciones...');
        const agregacionResult = await agregarADashboardCompleto(
            reporteData,
            reporteId,
            actividades,
            manoObra
        );
        
        if (!agregacionResult.success) {
            throw new Error('Fallo al aplicar nuevas agregaciones');
        }
        
        // 6. Actualizar timestamp de última actualización en todas las colecciones afectadas
        const batch = db.batch();
        
        // Marcar el reporte como recalculado
        batch.update(reporteRef, {
            ultimoRecalculo: admin.firestore.FieldValue.serverTimestamp(),
            estadoAgregacion: 'ACTUALIZADO'
        });
        
        await batch.commit();
        
        console.log(`[Recálculo Completo] Finalizado exitosamente para ${reporteId}`);
        return { success: true, reporteId };
        
    } catch (error) {
        console.error(`[Recálculo Completo] Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

module.exports = {
    agregarADashboard,
    deshacerAgregadoDashboard,
    deshacerAgregadoDashboardCompleto,
    agregarADashboardCompleto,
    recalcularAgregadosCompletos,
    limpiarDashboard,
    consolidarDatosReporte,
    obtenerSemanaISO,
    sanitizarId,
    extraerPrecioUnitario
};