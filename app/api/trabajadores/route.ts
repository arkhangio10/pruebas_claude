import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get('fechaInicio') || new Date().toISOString().slice(0,10);
    const fechaFin = searchParams.get('fechaFin') || new Date().toISOString().slice(0,10);
    const tipoVista = searchParams.get('tipoVista') || 'diario';
    
    console.log(`API Trabajadores - Filtros: inicio=${fechaInicio}, fin=${fechaFin}, tipoVista=${tipoVista}`);
    
    console.log(`API Trabajadores - Consultando colección 'Trabajadores_Resumen'`);
    
    // Intentamos obtener datos con el filtro adecuado según el tipo de vista
    let snapshot;
    
    try {
      if (tipoVista === 'diario') {
        // Para vista diaria, buscar por fecha específica
        console.log(`Buscando registros para la fecha: ${fechaInicio}`);
        snapshot = await adminDb.collection('Trabajadores_Resumen')
          .where('ultimaActividad', '==', fechaInicio)
          .get();
      } else if (tipoVista === 'semanal' || tipoVista === 'mensual' || tipoVista === 'rango') {
        // Para rangos de fechas, buscar por rango de actividad
        console.log(`Buscando registros en rango: ${fechaInicio} a ${fechaFin}`);
        snapshot = await adminDb.collection('Trabajadores_Resumen')
          .where('ultimaActividad', '>=', fechaInicio)
          .where('ultimaActividad', '<=', fechaFin)
          .get();
      } else {
        // Si no hay filtro específico o hay algún error, traer todos
        snapshot = await adminDb.collection('Trabajadores_Resumen').get();
      }
    } catch (err) {
      console.error("Error al filtrar por fecha:", err);
      // Si hay un error con el filtrado, intentamos traer todos los registros
      snapshot = await adminDb.collection('Trabajadores_Resumen').get();
    }
    
    console.log(`API Trabajadores - Encontrados: ${snapshot.docs.length} documentos`);
    
    // Registrar los IDs y una muestra de datos para ayudar a depurar
    if (snapshot.docs.length > 0) {
      console.log(`Primer documento ID: ${snapshot.docs[0].id}`);
      console.log(`Muestra de datos:`, JSON.stringify(snapshot.docs[0].data()).substring(0, 300));
    }
    
    // Analizar las diferentes estructuras de datos que pueden venir
    console.log('Analizando estructura de documentos para extracción óptima');
    
    // Comprobamos una muestra de documentos para entender la estructura
    const sampleDoc = snapshot.docs.length > 0 ? snapshot.docs[0].data() : null;
    let keyPattern = '';
    
    if (sampleDoc) {
      // Detectar el patrón de las claves para saber cómo extraer datos
      const keys = Object.keys(sampleDoc);
      console.log('Claves encontradas en la muestra:', keys.slice(0, 10).join(', '));
      
      if (keys.some(k => k.includes('.'))) {
        keyPattern = 'dotted'; // formato periodos.diario.2025-08-13.horas
        console.log('Detectado formato de claves con puntos');
      } else if (sampleDoc.resumen || sampleDoc.periodos) {
        keyPattern = 'nested'; // formato anidado { resumen: { horas: 10 } }
        console.log('Detectado formato de objetos anidados');
      } else {
        keyPattern = 'flat'; // formato plano { horas: 10 }
        console.log('Detectado formato plano');
      }
    }
    
    const trabajadores = snapshot.docs.map(doc => {
      const data = doc.data();
      const id = doc.id;
      
      // Intentamos extraer datos específicos para una respuesta más limpia
      let nombre = id;
      let categoria = '';
      let ultimaActividad = '';
      let horas = 0;
      let metrado = 0;
      let costoMO = 0;
      let productividadMedia = 0;
      
      // Extraer datos según el patrón detectado
      if (keyPattern === 'dotted') {
        // Formato con puntos en las claves
        nombre = data['datos.nombre'] || data['nombre'] || id;
        categoria = data['datos.categoria'] || data['categoria'] || '';
        ultimaActividad = data['datos.ultimaActividad'] || data['ultimaActividad'] || '';
        horas = data['resumen.horas'] || 0;
        metrado = data['resumen.metrado'] || 0;
        costoMO = data['resumen.costoMO'] || 0;
        productividadMedia = data['resumen.totalProduccion.productividadMedia'] || 0;
        
        // Si estamos en un tipo de vista específica, intentar obtener datos de ese período
        if (tipoVista === 'diario' && data[`periodos.diario.${fechaInicio}.horas`]) {
          horas = data[`periodos.diario.${fechaInicio}.horas`] || horas;
          metrado = data[`periodos.diario.${fechaInicio}.metrado`] || metrado;
          costoMO = data[`periodos.diario.${fechaInicio}.costoMO`] || costoMO;
        }
      } else if (keyPattern === 'nested') {
        // Formato con objetos anidados
        nombre = data.datos?.nombre || data.nombre || id;
        categoria = data.datos?.categoria || data.categoria || '';
        ultimaActividad = data.datos?.ultimaActividad || data.ultimaActividad || '';
        horas = data.resumen?.horas || 0;
        metrado = data.resumen?.metrado || 0;
        costoMO = data.resumen?.costoMO || 0;
        productividadMedia = data.resumen?.totalProduccion?.productividadMedia || 0;
        
        // Acceso a periodos específicos si están disponibles
        if (data.periodos) {
          if (tipoVista === 'diario' && data.periodos.diario?.[fechaInicio]) {
            const periodoData = data.periodos.diario[fechaInicio];
            horas = periodoData.horas || horas;
            metrado = periodoData.metrado || metrado;
            costoMO = periodoData.costoMO || costoMO;
          } else if (tipoVista === 'semanal' && data.periodos.semanal) {
            // Buscar una semana que incluya la fecha
            const semanasKeys = Object.keys(data.periodos.semanal);
            for (const semanaKey of semanasKeys) {
              const [semanaInicio, semanaFin] = semanaKey.split('_');
              if (fechaInicio >= semanaInicio && (fechaFin || fechaInicio) <= semanaFin) {
                const periodoData = data.periodos.semanal[semanaKey];
                horas = periodoData.horas || horas;
                metrado = periodoData.metrado || metrado;
                costoMO = periodoData.costoMO || costoMO;
                break;
              }
            }
          } else if (tipoVista === 'mensual' && data.periodos.mensual) {
            // Buscar un mes que incluya la fecha
            const mesKey = fechaInicio.substring(0, 7); // YYYY-MM
            if (data.periodos.mensual[mesKey]) {
              const periodoData = data.periodos.mensual[mesKey];
              horas = periodoData.horas || horas;
              metrado = periodoData.metrado || metrado;
              costoMO = periodoData.costoMO || costoMO;
            }
          }
        }
      } else {
        // Formato plano o desconocido - intentar buscar campos directamente
        nombre = data.nombre || id;
        categoria = data.categoria || '';
        ultimaActividad = data.ultimaActividad || '';
        horas = data.horas || 0;
        metrado = data.metrado || 0;
        costoMO = data.costoMO || 0;
        productividadMedia = data.productividadMedia || 0;
      }
      
      // Asegurar que tenemos una categoría válida
      if (!categoria || !['OPERARIO', 'OFICIAL', 'PEON'].includes(categoria.toUpperCase())) {
        const nombreUpper = nombre.toUpperCase();
        if (nombreUpper.includes('OPERARIO') || 
            nombreUpper.includes('MAMANI') || 
            nombreUpper.includes('FLORES') || 
            nombreUpper.includes('BEDOYA')) {
          categoria = 'OPERARIO';
        } else if (nombreUpper.includes('OFICIAL') || 
                  nombreUpper.includes('VILLALVA') || 
                  nombreUpper.includes('GONZALES') || 
                  nombreUpper.includes('QUISPE')) {
          categoria = 'OFICIAL';
        } else {
          categoria = 'PEON';
        }
      } else {
        categoria = categoria.toUpperCase();
      }
      
      return {
        id,
        nombre,
        categoria,
        ultimaActividad,
        resumen: {
          horas,
          metrado,
          costoMO,
          productividadMedia: productividadMedia || (horas > 0 ? metrado / horas : 0)
        }
      };
    });
    
    console.log(`Total de trabajadores antes del filtrado: ${trabajadores.length}`);
    // Filtramos trabajadores que tengan horas > 0
    const trabajadoresFiltrados = trabajadores.filter(t => t.resumen.horas > 0);
    console.log(`Total de trabajadores después del filtrado (horas > 0): ${trabajadoresFiltrados.length}`);
    
    if (trabajadoresFiltrados.length > 0) {
      console.log('Ejemplo de trabajador filtrado:', JSON.stringify(trabajadoresFiltrados[0], null, 2));
    } else {
      console.log('No hay trabajadores con horas > 0');
    }
    
    // Ordenamos por productividad descendente
    trabajadoresFiltrados.sort((a, b) => {
      const prodA = a.resumen.productividadMedia;
      const prodB = b.resumen.productividadMedia;
      return prodB - prodA;
    });
    
    return NextResponse.json({ 
      trabajadores: trabajadoresFiltrados,
      metadata: {
        fechaInicio,
        fechaFin,
        tipoVista
      }
    });
    
  } catch (error) {
    console.error('Error al obtener datos de trabajadores:', error);
    return NextResponse.json({ 
      error: 'Error al procesar la solicitud', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
