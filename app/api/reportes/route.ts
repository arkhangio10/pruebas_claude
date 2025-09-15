import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';

// Definir interfaz para los reportes
interface Reporte {
  id: string;
  elaboradoPor: string; // creadoPor en reportes_links
  fecha: string;
  bloque: string; // derivado de subcontratistaBLoque
  estado: string; // calculado
  revisadoPor?: string;
  spreadsheetUrl?: string; // enlaceSheet en reportes_links
  enlaceCarpeta?: string;
  enlaceDrive?: string; // puede ser el mismo que enlaceSheet
  error?: string;
  subcontratistaBloque?: string; // subcontratistaBLoque en reportes_links
  fechaProcesamiento?: string; // creadoEn/ultimaActualizacion en reportes_links
  valorizado?: number; // totalValorizado en reportes_links
  trabajadores?: number; // totalTrabajadores en reportes_links
  actividades?: number; // totalActividades en reportes_links
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get('fechaInicio') || '';
    const fechaFin = searchParams.get('fechaFin') || '';
    const estado = searchParams.get('estado') || null;
    const subcontratista = searchParams.get('subcontratista') || null;
    
    console.log(`Obteniendo reportes desde ${fechaInicio} hasta ${fechaFin}${estado ? `, estado: ${estado}` : ''}${subcontratista ? `, subcontratista: ${subcontratista}` : ''}`);
    
    // NOMBRE EXACTO de la colección en Firestore
    const COLLECTION_NAME = 'Reportes_Links';
    
    // VERIFICACIÓN DE FIRESTORE
    try {
      console.log("=== DIAGNÓSTICO DE FIRESTORE ===");
      const collections = await adminDb.listCollections();
      const collectionIds = collections.map(col => col.id);
      console.log("Colecciones disponibles:", collectionIds);
      
      // Consultar directamente la colección correcta
      const testSnapshot = await adminDb.collection(COLLECTION_NAME).get();
      console.log(`Total documentos en '${COLLECTION_NAME}': ${testSnapshot.size}`);
      
      if (testSnapshot.size > 0) {
        // Mostrar IDs de los primeros 10 documentos como diagnóstico
        console.log("Muestra de IDs:", testSnapshot.docs.slice(0, 10).map(doc => doc.id));
        
        // Mostrar estructura del primer documento
        const sampleDoc = testSnapshot.docs[0];
        const data = sampleDoc.data();
        console.log("Estructura del documento:", {
          id: sampleDoc.id,
          campos: Object.keys(data),
          datos: {
            fecha: data.fecha,
            creadoPor: data.creadoPor,
            subcontratistaBLoque: data.subcontratistaBLoque,
            totalValorizado: data.totalValorizado,
            totalTrabajadores: data.totalTrabajadores,
            totalActividades: data.totalActividades
          }
        });
      }
    } catch (err) {
      console.error("Error en diagnóstico:", err);
    }
    
  // Construir la consulta - usando el nombre exacto de la colección
  let query: FirebaseFirestore.Query<DocumentData> = adminDb.collection(COLLECTION_NAME);
    
    // Aplicar filtros de fecha si están definidos
    if (fechaInicio && fechaFin) {
      console.log(`Filtrando por rango de fecha: ${fechaInicio} a ${fechaFin}`);
      query = query.where('fecha', '>=', fechaInicio);
      query = query.where('fecha', '<=', fechaFin);
    } else if (fechaInicio) {
      console.log(`Filtrando desde fecha: ${fechaInicio}`);
      query = query.where('fecha', '>=', fechaInicio);
    } else if (fechaFin) {
      console.log(`Filtrando hasta fecha: ${fechaFin}`);
      query = query.where('fecha', '<=', fechaFin);
    }
    
    // Aplicar filtro de subcontratista si se proporciona
    const wantsSubFilter = !!(subcontratista && subcontratista !== 'TODOS');
    if (wantsSubFilter) {
      console.log(`Filtrando por subcontratista: ${subcontratista}`);
      query = query.where('subcontratistaBLoque', '==', subcontratista as string);
    }
    
    // Ordenar por fecha descendente
    query = query.orderBy('fecha', 'desc');
    
    // Ejecutar la consulta, con fallback si se requiere índice compuesto
    let reportesSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
    let filteredInMemory = false;
    try {
      reportesSnapshot = await query.get();
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : String(err);
      const needsIndex = msg.toLowerCase().includes('requires a composite index') || err?.code === 9 || err?.code === 'failed-precondition';
      if (wantsSubFilter && needsIndex) {
        console.warn('Consulta con subcontratista requiere índice. Reintentando sin subcontratista y filtrando en memoria.');
        // Construir una consulta equivalente pero sin el where de subcontratista
  let q2: FirebaseFirestore.Query<DocumentData> = adminDb.collection(COLLECTION_NAME);
        if (fechaInicio && fechaFin) {
          q2 = q2.where('fecha', '>=', fechaInicio).where('fecha', '<=', fechaFin);
        } else if (fechaInicio) {
          q2 = q2.where('fecha', '>=', fechaInicio);
        } else if (fechaFin) {
          q2 = q2.where('fecha', '<=', fechaFin);
        }
        q2 = q2.orderBy('fecha', 'desc');
        reportesSnapshot = await q2.get();
        filteredInMemory = true;
      } else {
        throw err;
      }
    }
    console.log(`La consulta retornó ${reportesSnapshot.size} documentos`);
    
  // Verificar si el documento específico 'tt6WjJyIBNksQ46pR2l8' está incluido en los resultados
  const docIds = reportesSnapshot.docs.map(doc => doc.id);
  console.log("¿Contiene el ID tt6WjJyIBNksQ46pR2l8?", docIds.includes('tt6WjJyIBNksQ46pR2l8') ? "SÍ" : "NO");
  console.log("IDs encontrados:", docIds);
    
    // Si no hay resultados, devolver respuesta vacía
    if (reportesSnapshot.empty) {
      console.log('No se encontraron reportes con los filtros proporcionados');
      return NextResponse.json({ 
        reportes: [],
        metadata: {
          fechaInicio, fechaFin, estado, subcontratista,
          total: 0
        }
      });
    }
    
    // Transformar los datos de Firestore a nuestro formato
    const reportes: Reporte[] = [];
    const subcontratistas = new Set<string>();
    const procesadosIds = new Set<string>();  // Para evitar duplicados
    
    console.log(`Procesando ${reportesSnapshot.size} documentos...`);
    
    // Array para almacenar IDs de reportes procesados (para diagnóstico)
    const procesadosReporteIds: string[] = [];
    
  reportesSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      
      // Si ya procesamos este documento, saltarlo
      if (procesadosIds.has(doc.id)) {
        console.log(`Saltando documento duplicado: ${doc.id}`);
        return;
      }
      
      // Marcar como procesado
      procesadosIds.add(doc.id);
      procesadosReporteIds.push(doc.id);
      
      // Log detallado de cada documento para diagnóstico
      console.log(`Procesando documento [${doc.id}]:`, {
        fecha: data.fecha,
        creadoPor: data.creadoPor,
        subcontratistaBLoque: data.subcontratistaBLoque
      });
      
      // Extraer información del bloque
      let bloque = 'BLOQUE 40'; // Valor predeterminado
      if (data.subcontratistaBLoque) {
        const match = data.subcontratistaBLoque.match(/bloque\s*(\d+)/i);
        if (match && match[1]) {
          bloque = `BLOQUE ${match[1]}`;
        } else {
          // Si no tiene formato "bloque X", usar el valor directamente
          bloque = data.subcontratistaBLoque;
        }
      }
      
      // Determinar valores numéricos
      const trabajadores = typeof data.totalTrabajadores === 'number' ? data.totalTrabajadores : 0;
      const actividades = typeof data.totalActividades === 'number' ? data.totalActividades : 0;
      const valorizado = typeof data.totalValorizado === 'number' ? data.totalValorizado : 0;
      
      // Determinar estado basado en datos
      let estado = 'PENDIENTE';
      
      // Si hay un error explícito, usarlo
      if (data.error) {
        estado = data.error.includes('crítico') ? 'ERROR_CRITICO' : 'ERROR';
      }
      // Si tiene enlace pero no hay datos, es un error
      else if (data.enlaceSheet) {
        if (trabajadores > 0 || actividades > 0 || valorizado > 0) {
          estado = 'PROCESADO';
        } else {
          estado = 'ERROR';
        }
      }
      
      // Crear el objeto de reporte con el formato requerido
      const reporte: Reporte = {
        id: doc.id,
        elaboradoPor: data.creadoPor || 'Sin asignar',
        fecha: data.fecha || '',
        bloque: bloque,
        estado: estado,
        revisadoPor: data.revisadoPor || '',
        spreadsheetUrl: data.enlaceSheet || '',
        enlaceCarpeta: '',
        enlaceDrive: data.enlaceSheet || '',
        error: data.error || '',
        subcontratistaBloque: data.subcontratistaBLoque || '',
        fechaProcesamiento: data.ultimaActualizacion ? 
          (typeof data.ultimaActualizacion === 'string' ? data.ultimaActualizacion : 
           data.ultimaActualizacion instanceof Timestamp ? data.ultimaActualizacion.toDate().toISOString() : 
           '') : '',
        valorizado: valorizado,
        trabajadores: trabajadores,
        actividades: actividades
      };
      
      // Registrar subcontratista para filtros
      if (data.subcontratistaBLoque) {
        subcontratistas.add(data.subcontratistaBLoque);
      }
      
      reportes.push(reporte);
    });
    
    console.log(`Se procesaron ${reportes.length} reportes únicos de ${reportesSnapshot.size} documentos`);
    console.log("IDs procesados:", procesadosReporteIds);
    
    // Aplicar filtros adicionales en memoria si es necesario
    let reportesFiltrados = reportes;
    if (filteredInMemory && wantsSubFilter) {
      reportesFiltrados = reportesFiltrados.filter(r => r.subcontratistaBloque === subcontratista);
      console.log(`Filtrado en memoria por subcontratista ${subcontratista}: ${reportesFiltrados.length} reportes`);
    }
    // Filtrar por estado si se proporciona
    if (estado && estado !== 'TODOS') {
      console.log(`Filtrando por estado ${estado} de ${reportes.length} reportes`);
      // Implementamos el filtrado con sensibilidad a mayúsculas/minúsculas
      reportesFiltrados = reportesFiltrados.filter(r => r.estado.toUpperCase() === estado.toUpperCase());
      console.log(`Filtrado por estado ${estado}: ${reportesFiltrados.length} reportes`);
    }
    
    return NextResponse.json({ 
      reportes: reportesFiltrados,
      metadata: {
        fechaInicio, fechaFin, estado, subcontratista,
        subcontratistas: Array.from(subcontratistas).sort(),
        total: reportesFiltrados.length,
        debug: {
          collectionUsed: COLLECTION_NAME,
          totalDocuments: reportesSnapshot.size,
          uniqueDocuments: reportes.length,
          finalCount: reportesFiltrados.length,
          filteredInMemory,
          wantsSubFilter
        }
      }
    });
    
  } catch (error) {
    console.error('Error al obtener los reportes:', error);
    return NextResponse.json({ 
      error: 'Error al procesar la solicitud',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
