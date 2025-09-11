const { google } = require("googleapis");
const admin = require("firebase-admin");
const { COSTOS_POR_HORA, CATEGORIAS_ORDENADAS, extraerPrecioUnitario } = require("./utils");
// ELIMINADO: dashboard-data-generator ya no es necesario, usamos dashboard-etl-generator
// const { generarDatosDashboard } = require("./dashboard-data-generator");

// --- Funciones de Utilidad (Internas) ---

async function obtenerDatos(reporteId) {
  const db = admin.firestore();
  const [actividadesSnapshot, manoObraSnapshot] = await Promise.all([
    db.collection(`Reportes/${reporteId}/actividades`).get(),
    db.collection(`Reportes/${reporteId}/mano_obra`).get()
  ]);
  const actividades = actividadesSnapshot.docs.map(doc => doc.data());
  const manoObra = manoObraSnapshot.docs.map(doc => doc.data());
  return [actividades, manoObra];
}

// --- Lógica de Google Sheets ---

async function crearHojaCalculo(sheets, data) {
  const fechaHoy = new Date().toISOString().split("T")[0];
  const nombreArchivo = `Reporte_${fechaHoy}_${data.elaboradoPor || "sin_nombre"}`;

  const spreadsheet = await sheets.spreadsheets.create({
    resource: {
      properties: { title: nombreArchivo },
      sheets: [
        { properties: { title: "Resumen" } },
        { properties: { title: "Datos_Completos" } },
        { properties: { title: "Costos" } }
      ]
    }
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  
  const spreadsheetInfo = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties"
  });
  
  const sheetIds = {};
  for (const sheet of spreadsheetInfo.data.sheets) {
    sheetIds[sheet.properties.title] = sheet.properties.sheetId;
  }
  
  return { spreadsheetId, sheetIds };
}

function calcularDatosAgregados(actividades, manoObra) {
  const horasPorActividad = new Array(actividades.length).fill(0);
  let totalHorasGeneral = 0;
  
  const categoriasDatos = {};
  manoObra.forEach(trab => {
    const categoria = trab.categoria?.toUpperCase() || "SIN CATEGORÍA";
    
    if (!categoriasDatos[categoria]) {
      categoriasDatos[categoria] = { 
        cantidad: 0, 
        horas: 0, 
        costo: 0 
      };
    }
    
    if (Array.isArray(trab.horas)) {
      let horasTotalesTrabajador = 0;
      
      trab.horas.forEach((h, idx) => {
        if (idx >= actividades.length) return;
        
        const horas = parseFloat(h || 0);
        if (horas > 0) {
          horasPorActividad[idx] += horas;
          horasTotalesTrabajador += horas;
          
          const costoPorHora = COSTOS_POR_HORA[categoria] || 0;
          categoriasDatos[categoria].costo += horas * costoPorHora;
        }
      });
      
      if (horasTotalesTrabajador > 0) {
        categoriasDatos[categoria].cantidad++;
        categoriasDatos[categoria].horas += horasTotalesTrabajador;
        totalHorasGeneral += horasTotalesTrabajador;
      }
    }
  });
  
  const totalMetradoProg = actividades.reduce((sum, act) => sum + parseFloat(act.metradoP || 0), 0);
  const totalMetradoEjec = actividades.reduce((sum, act) => sum + parseFloat(act.metradoE || 0), 0);
  
  let valorTotalGeneral = 0;
  let costoTotalMO = 0;
  
  actividades.forEach((act, idx) => {
    const metradoE = parseFloat(act.metradoE || 0);
    const precioUnitario = extraerPrecioUnitario(act);
    
    const valorMetrado = metradoE * precioUnitario;
    valorTotalGeneral += valorMetrado;
    
    let costoManoObraAct = 0;
    manoObra.forEach(trab => {
      if (trab.horas && idx < trab.horas.length) {
        const horas = parseFloat(trab.horas[idx] || 0);
        const categoria = trab.categoria?.toUpperCase();
        const costoPorHora = COSTOS_POR_HORA[categoria] || 0;
        costoManoObraAct += horas * costoPorHora;
      }
    });
    
    costoTotalMO += costoManoObraAct;
  });
  
  const gananciaTotal = valorTotalGeneral - costoTotalMO;
  const categoriasUnicas = Object.keys(categoriasDatos);
  
  let sumProductividad = 0;
  let countActividades = 0;
  
  actividades.forEach((act, idx) => {
    const metradoE = parseFloat(act.metradoE || 0);
    const horasActividad = horasPorActividad[idx] || 0;
    
    if (horasActividad > 0 && metradoE > 0) {
      sumProductividad += metradoE / horasActividad;
      countActividades++;
    }
  });
  
  const productividadPromedio = countActividades > 0 ? sumProductividad / countActividades : 0;
  
  return {
    horasPorActividad,
    totalHorasGeneral,
    categoriasDatos,
    categoriasUnicas,
    totalMetradoProg,
    totalMetradoEjec,
    valorTotalGeneral,
    costoTotalMO,
    productividadPromedio,
    gananciaTotal
  };
}

async function generarHojaDatosCompletos(sheets, spreadsheetId, actividades, manoObra) {
  const headersBase = [
    "Tipo", "Ítem", "Proceso / Actividad", "UND", "Ubicación",
    "Metrado P.", "Metrado E.", "% Ejecución", "Causa de No Cumplimiento", "PRECIO UNITARIO",
    "Trabajador", "Categoría", "Especificación"
  ];

  const actividadHeaders = actividades.map((_, i) => `Act. ${i + 1}`);
  const cabecera = [...headersBase, ...actividadHeaders, "Observación", "Comentarios"];

  const filasActividades = actividades.map((act, idx) => {
    const metradoP = parseFloat(act.metradoP || 0);
    const metradoE = parseFloat(act.metradoE || 0);
    const porcentaje = metradoP > 0 ? ((metradoE / metradoP) * 100).toFixed(2) + "%" : "0%";
    const precioUnitario = extraerPrecioUnitario(act);
    
    return [
      "Actividad",
      act.numero || (idx + 1),
      act.proceso || "",
      act.und || "",
      act.ubicacion || "",
      metradoP,
      metradoE,
      porcentaje,
      act.causas || "",
      precioUnitario,
      "", "", "",
      ...Array(actividades.length).fill(""),
      "", // Placeholder for Observacion column
      act.comentarios || ""
    ];
  });

  const filasManoObra = manoObra.map(trab => {
    const horasPorActividad = actividades.map((_, idx) =>
      Array.isArray(trab.horas) && idx < trab.horas.length ? trab.horas[idx] : "0"
    );

    return [
      "Mano de Obra",
      trab.item || "",
      "", "", "", "", "", "", "", "",
      trab.trabajador || "",
      trab.categoria || "",
      trab.especificacion || "",
      ...horasPorActividad,
      trab.observacion || "",
      "" // Placeholder for Comentarios column
    ];
  });

  const datosCompletos = [cabecera, ...filasActividades, ...filasManoObra];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Datos_Completos!A1",
    valueInputOption: "USER_ENTERED",
    resource: { values: datosCompletos }
  });
}

async function generarHojaResumen(sheets, spreadsheetId, data, actividades, manoObra, datosCalculados) {
  const { categoriasUnicas, valorTotalGeneral } = datosCalculados;
  
  const resumen = [
    ["Elaborado por", data.elaboradoPor || ""],
    ["Fecha", data.fecha || ""],
    ["Subcontratista/Bloque", data.subcontratistaBloque || ""],
    ["Revisado por", data.revisadoPor || ""],
    ["Total Actividades", actividades.length],
    ["Total Trabajadores", manoObra.length],
    ["Total Valorizado:", valorTotalGeneral.toFixed(2)],
    []
  ];

  const headerResumen = [
    "ACTIVIDAD", "UND", "Metrado Prog.", "Metrado Ejec.", "AVANCE %", "PRECIO UNIT.", "VALOR METRADO"
  ];
  
  categoriasUnicas.forEach(cat => {
    headerResumen.push(`${cat} (Cant.)`);
    headerResumen.push(`${cat} (HH)`);
  });

  resumen.push(headerResumen);

  actividades.forEach((act, idx) => {
    const nombre = act.proceso || `Actividad ${idx + 1}`;
    const unidad = act.und || "";
    const metradoP = parseFloat(act.metradoP || 0);
    const metradoE = parseFloat(act.metradoE || 0);
    const porcentaje = metradoP > 0 ? `${((metradoE / metradoP) * 100).toFixed(2)}%` : "0%";

    const resumenPorCategoria = {};
    categoriasUnicas.forEach(cat => {
      resumenPorCategoria[cat] = { cantidad: 0, hh: 0 };
    });

    let costoManoObra = 0;

    manoObra.forEach(trab => {
      const cat = trab.categoria?.toUpperCase();
      if (resumenPorCategoria[cat] && Array.isArray(trab.horas) && idx < trab.horas.length) {
        const horas = parseFloat(trab.horas[idx] || 0);
        if (horas > 0) {
          resumenPorCategoria[cat].cantidad += 1;
          resumenPorCategoria[cat].hh += horas;
          
          const costoPorHora = COSTOS_POR_HORA[cat] || 0;
          costoManoObra += horas * costoPorHora;
        }
      }
    });

    const precioUnitario = extraerPrecioUnitario(act);
    const valorMetrado = metradoE * precioUnitario;
    
    const filaResumen = [
      nombre, 
      unidad, 
      metradoP, 
      metradoE, 
      porcentaje,
      precioUnitario.toFixed(2),
      valorMetrado.toFixed(2)
    ];
    
    categoriasUnicas.forEach(cat => {
      filaResumen.push(resumenPorCategoria[cat].cantidad);
      filaResumen.push(resumenPorCategoria[cat].hh);
    });
    
    resumen.push(filaResumen);
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Resumen!A1",
    valueInputOption: "USER_ENTERED",
    resource: { values: resumen }
  });
}

async function generarHojaCostos(sheets, spreadsheetId, data, actividades, manoObra, datosCalculados) {
  const { categoriasUnicas, valorTotalGeneral, costoTotalMO, gananciaTotal } = datosCalculados;
  
  const costos = [
    ["REPORTE DIARIO DE PRODUCCIÓN"],
    [],
    ["Elaborado por:", data.elaboradoPor || ""],
    ["Fecha:", data.fecha || ""],
    ["Subcontratista/Bloque:", data.subcontratistaBloque || ""],
    ["Revisado por:", data.revisadoPor || ""],
    ["Total Actividades:", actividades.length],
    ["Total Trabajadores:", manoObra.length],
    ["Total Valorizado:", valorTotalGeneral.toFixed(2)],
    [],
    ["COSTOS POR HORA"],
    ["CATEGORÍA", "COSTO/HORA"],
  ];
  
  Object.entries(COSTOS_POR_HORA).forEach(([cat, costo]) => {
    costos.push([cat, costo]);
  });
  
  costos.push([]);

  const encabezadoCostos = [
    "ACTIVIDAD", "UND", "Metrado Prog.", "Metrado Ejec.", "AVANCE %", "PRECIO UNIT.", "VALOR METRADO"
  ];

  const categoriasFinal = [];
  
  CATEGORIAS_ORDENADAS.forEach(catOrdenada => {
    if (categoriasUnicas.includes(catOrdenada)) {
      categoriasFinal.push(catOrdenada);
      encabezadoCostos.push(`${catOrdenada} (HH)`);
      encabezadoCostos.push(`${catOrdenada} (COSTO S/.)`);
    }
  });

  categoriasUnicas.forEach(cat => {
    if (!CATEGORIAS_ORDENADAS.includes(cat)) {
      categoriasFinal.push(cat);
      encabezadoCostos.push(`${cat} (HH)`);
      encabezadoCostos.push(`${cat} (COSTO S/.)`);
    }
  });

  encabezadoCostos.push("COSTO TOTAL MO");
  encabezadoCostos.push("GANANCIA");
  costos.push(encabezadoCostos);

  let costoTotalActividades = 0;
  let totalValorMetrado = 0;
  const totalPorCategoria = {};
  
  categoriasUnicas.forEach(cat => {
    totalPorCategoria[cat] = { horas: 0, costo: 0 };
  });

  actividades.forEach((act, idx) => {
    const nombre = act.proceso || `Actividad ${idx + 1}`;
    const unidad = act.und || "";
    const metradoP = parseFloat(act.metradoP || 0);
    const metradoE = parseFloat(act.metradoE || 0);
    const porcentaje = metradoP > 0 ? `${((metradoE / metradoP) * 100).toFixed(2)}%` : "0%";
    
    let costoTotalMO = 0;
    
    const categoriasDatos = {};
    categoriasUnicas.forEach(cat => {
      categoriasDatos[cat] = { horas: 0, costo: 0 };
    });
    
    manoObra.forEach(trab => {
      const cat = trab.categoria?.toUpperCase();
      if (categoriasDatos[cat] && Array.isArray(trab.horas) && idx < trab.horas.length) {
        const horas = parseFloat(trab.horas[idx] || 0);
        if (horas > 0) {
          categoriasDatos[cat].horas += horas;
          
          const costoPorHora = COSTOS_POR_HORA[cat] || 0;
          const costoCategoria = horas * costoPorHora;
          categoriasDatos[cat].costo += costoCategoria;
          costoTotalMO += costoCategoria;
          
          totalPorCategoria[cat].horas += horas;
          totalPorCategoria[cat].costo += costoCategoria;
        }
      }
    });
    
    const precioUnitario = extraerPrecioUnitario(act);
    const valorMetrado = metradoE * precioUnitario;
    
    const gananciaActividad = valorMetrado - costoTotalMO;
    
    costoTotalActividades += costoTotalMO;
    totalValorMetrado += valorMetrado;
    
    const filaCostos = [
      nombre,
      unidad,
      metradoP,
      metradoE,
      porcentaje,
      precioUnitario.toFixed(2),
      valorMetrado.toFixed(2)
    ];
    
    categoriasFinal.forEach(cat => {
      filaCostos.push(categoriasDatos[cat].horas);
      filaCostos.push(categoriasDatos[cat].costo.toFixed(2));
    });
    
    filaCostos.push(costoTotalMO.toFixed(2));
    filaCostos.push(gananciaActividad.toFixed(2));
    costos.push(filaCostos);
  });

  const filaTotales = ["TOTALES", "", "", "", "", ""];
  
  const gananciaTotalActividades = totalValorMetrado - costoTotalActividades;

  filaTotales.push(totalValorMetrado.toFixed(2));

  categoriasFinal.forEach(cat => {
    filaTotales.push(totalPorCategoria[cat].horas);
    filaTotales.push(totalPorCategoria[cat].costo.toFixed(2));
  });

  filaTotales.push(costoTotalActividades.toFixed(2));
  filaTotales.push(gananciaTotalActividades.toFixed(2));
  costos.push(filaTotales);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Costos!A1",
    valueInputOption: "USER_ENTERED",
    resource: { values: costos }
  });
}

async function compartirDocumento(drive, spreadsheetId, reporteId) {
  const db = admin.firestore();
  try {
    const busquedaCarpeta = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and name='Reportes Producción - PRUEBA' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    let carpetaId;
    if (busquedaCarpeta.data.files.length === 0) {
      const folderResponse = await drive.files.create({
        resource: {
          name: 'Reportes Producción - PRUEBA',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      carpetaId = folderResponse.data.id;
      
      const emailsCompartir = ['abel.mancilla@hergonsa.pe'];
      for (const email of emailsCompartir) {
        await drive.permissions.create({
          fileId: carpetaId,
          requestBody: {
            type: 'user',
            role: 'writer',
            emailAddress: email
          }
        });
      }
      
      console.log(`✅ Carpeta principal creada y compartida con ID: ${carpetaId}`);
    } else {
      carpetaId = busquedaCarpeta.data.files[0].id;
      console.log(`✅ Usando carpeta principal existente con ID: ${carpetaId}`);
    }
    
    const fechaActual = new Date();
    const anio = fechaActual.getFullYear();
    const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
    const nombreSubcarpeta = `${anio}-${mes}`;
    
    const busquedaSubcarpeta = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${nombreSubcarpeta}' and '${carpetaId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    let subcarpetaId;
    if (busquedaSubcarpeta.data.files.length === 0) {
      const subcarpetaResponse = await drive.files.create({
        resource: {
          name: nombreSubcarpeta,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [carpetaId]
        },
        fields: 'id'
      });
      subcarpetaId = subcarpetaResponse.data.id;
      console.log(`✅ Subcarpeta ${nombreSubcarpeta} creada con ID: ${subcarpetaId}`);
    } else {
      subcarpetaId = busquedaSubcarpeta.data.files[0].id;
      console.log(`✅ Usando subcarpeta ${nombreSubcarpeta} existente con ID: ${subcarpetaId}`);
    }
    
    // Mover el archivo a la subcarpeta correcta
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: subcarpetaId,
      removeParents: 'root',
      fields: 'id, parents'
    });
    
    const emailsCompartir = ['abel.mancilla@hergonsa.pe'];
    for (const email of emailsCompartir) {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: email,
          sendNotificationEmail: true,
          emailMessage: `Se ha generado un nuevo reporte de producción. 
Enlace al reporte: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing
Enlace a la carpeta: https://drive.google.com/drive/folders/${subcarpetaId}?usp=sharing`
        }
      });
    }
    
    const archivo = await drive.files.get({
      fileId: spreadsheetId,
      fields: 'webViewLink,name'
    });
    
    const carpetaEnlace = `https://drive.google.com/drive/folders/${subcarpetaId}?usp=sharing`;
    
    console.log(`✅ Archivo "${archivo.data.name}" guardado en subcarpeta ${nombreSubcarpeta}`);
    console.log(`📄 Enlace al archivo: ${archivo.data.webViewLink}`);
    console.log(`📁 Enlace a la carpeta: ${carpetaEnlace}`);
    
    try {
      if (reporteId && typeof reporteId === 'string' && reporteId.trim().length > 0) {
        await db.collection("Reportes").doc(reporteId).update({
          enlaceDrive: archivo.data.webViewLink,
          enlaceCarpeta: carpetaEnlace,
          carpetaId: carpetaId,
          subcarpetaId: subcarpetaId,
          fechaOrganizacion: nombreSubcarpeta
        });
        console.log(`✅ Enlaces guardados en Firestore para documento: ${reporteId}`);
      } else {
        console.log(`⚠️ No se pudo guardar en Firestore: reporteId inválido (${reporteId})`);
      }
    } catch (dbError) {
      console.log(`⚠️ Error al guardar en Firestore: ${dbError.message}`);
    }
    
    return {
      archivoEnlace: archivo.data.webViewLink,
      carpetaEnlace: carpetaEnlace
    };
  } catch (error) {
    console.error(`❌ Error al compartir el documento: ${error.message}`);
    
    try {
      const archivo = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'webViewLink'
      });
      return { archivoEnlace: archivo.data.webViewLink };
    } catch (linkError) {
      console.error("No se pudo obtener el enlace del documento");
      throw error;
    }
  }
}

async function actualizarDocumentoReporte(reporteId, spreadsheetId) {
  const db = admin.firestore();
  await db.collection("Reportes").doc(reporteId).update({
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    spreadsheetId: spreadsheetId,
    procesadoEn: new Date().toISOString(),
    pendienteDashboard: true
  });
}


/**
 * Función Orquestadora Principal que será exportada.
 * Esta función es llamada por el trigger en index.js.
 */
exports.generarReporteCompletoEnSheets = async (reporteId, data) => {
  try {
    console.log("✅ Iniciando generación de reporte en Sheets para:", reporteId);

    // Autenticación con Google
    const auth = new google.auth.GoogleAuth({
      keyFile: "./credenciales.json",
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });
    const drive = google.drive({ version: "v3", auth: authClient });

    // Obtener datos de Firestore
    const [actividades, manoObra] = await obtenerDatos(reporteId);
    if (actividades.length === 0) {
      console.warn("⚠️ No se encontraron actividades para el reporte. Abortando.");
      return { success: false, error: "No hay actividades en el reporte." };
    }

    // Crear la hoja de cálculo
    const { spreadsheetId } = await crearHojaCalculo(sheets, data);
    console.log(`📄 Hoja de cálculo creada con ID: ${spreadsheetId}`);

    // Calcular datos agregados
    const datosCalculados = calcularDatosAgregados(actividades, manoObra);

    // Generar todas las pestañas en paralelo
    await Promise.all([
      generarHojaDatosCompletos(sheets, spreadsheetId, actividades, manoObra),
      generarHojaResumen(sheets, spreadsheetId, data, actividades, manoObra, datosCalculados),
      generarHojaCostos(sheets, spreadsheetId, data, actividades, manoObra, datosCalculados),
    ]);
    console.log("📊 Pestañas 'Datos_Completos', 'Resumen' y 'Costos' generadas.");

    // Compartir y organizar en Drive
    await compartirDocumento(drive, spreadsheetId, reporteId);

    // Actualizar el documento original en Firestore
    await actualizarDocumentoReporte(reporteId, spreadsheetId);
    console.log(`📝 Documento ${reporteId} en Firestore actualizado con los enlaces.`);

    // ELIMINADO: Dashboard se genera por separado en dashboard-etl-generator.js
    // const dashboardResult = await generarDatosDashboard(reporteId, data);
    console.log("📊 Dashboard se generará por separado en dashboard-etl-generator.js");

    console.log("🎉 Proceso completado exitosamente.");
    return { success: true, spreadsheetId, dashboard: null };

  } catch (error) {
    console.error("❌ Error fatal en generarReporteCompletoEnSheets:", error);
    // Opcional: Marcar el reporte con un error en Firestore para reintentar
    const db = admin.firestore();
    await db.collection("Reportes").doc(reporteId).update({
      errorGeneracion: error.message,
    });
    return { success: false, error: error.message };
  }
};