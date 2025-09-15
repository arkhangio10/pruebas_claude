import { NextRequest, NextResponse } from 'next/server';

// Esta es una implementación de proxy para BigQuery que devuelve datos de muestra
// cuando no se puede conectar directamente a BigQuery
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const inicio = searchParams.get('inicio') || new Date().toISOString().slice(0, 10);
  const fin = searchParams.get('fin') || inicio;
  
  console.log(`Solicitud a BigQuery Proxy: Fechas ${inicio} a ${fin}`);

  // Intentar conectar a la función original de BigQuery
  let datosBigQuery = null;
  const BIGQUERY_FUNCTION_URL = process.env.ORIGINAL_BIGQUERY_FUNCTION_URL;
  
  if (BIGQUERY_FUNCTION_URL) {
    try {
      console.log(`Intentando conectar a: ${BIGQUERY_FUNCTION_URL}?inicio=${inicio}&fin=${fin}`);
      
      const response = await fetch(
        `${BIGQUERY_FUNCTION_URL}?inicio=${inicio}&fin=${fin}`,
        { next: { revalidate: 60 } } // Cache por 1 minuto
      );
      
      if (response.ok) {
        datosBigQuery = await response.json();
        console.log('Datos obtenidos correctamente de BigQuery');
        return NextResponse.json(datosBigQuery);
      } else {
        console.error(`Error al conectar con BigQuery: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al conectar con BigQuery:', error);
    }
  }
  
  // Si llegamos aquí, o bien no tenemos configurada la URL o falló la conexión
  // Generamos datos de muestra para desarrollo
  console.log('Generando datos de muestra para desarrollo');

  // Generar fechas entre inicio y fin
  const fechas = [];
  const fechaInicio = new Date(inicio);
  const fechaFin = new Date(fin);
  for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
    fechas.push(d.toISOString().slice(0, 10));
  }
  
  // Datos de muestra para reportes
  const reportes = fechas.map((fecha, index) => ({
    id: `reporte-${index + 1}`,
    fecha,
    supervisor: ['Juan Pérez', 'María Gómez', 'Carlos Rodríguez'][Math.floor(Math.random() * 3)],
    obra: ['Edificio Central', 'Carretera Norte', 'Puente Sur'][Math.floor(Math.random() * 3)],
    estado: ['completado', 'en proceso', 'revisión'][Math.floor(Math.random() * 3)],
    actividades: Array(Math.floor(Math.random() * 5) + 1).fill(0).map((_, i) => ({
      id: `act-${index}-${i}`,
      nombre: ['Excavación', 'Cimentación', 'Estructura', 'Acabados', 'Instalaciones'][Math.floor(Math.random() * 5)],
      metradoE: Math.floor(Math.random() * 100) + 10,
      metradoP: Math.floor(Math.random() * 100) + 50,
      unidad: ['m3', 'm2', 'kg', 'unid'][Math.floor(Math.random() * 4)],
      precioUnitario: Math.floor(Math.random() * 500) + 100,
      total: Math.floor(Math.random() * 50000) + 5000,
      costoExpediente: Math.floor(Math.random() * 5000) + 500
    }))
  }));
  
  // Actividades (extraídas de reportes para simplicidad)
  const actividades = [];
  reportes.forEach(reporte => {
    reporte.actividades.forEach(actividad => {
      actividades.push({
        ...actividad,
        fecha: reporte.fecha,
        obra: reporte.obra,
        reporte: reporte.id
      });
    });
  });
  
  // Trabajadores de muestra
  const trabajadores = [
    { nombre: 'Luis Martinez', cargo: 'Operario', especialidad: 'Albañilería' },
    { nombre: 'Ana Gutiérrez', cargo: 'Técnico', especialidad: 'Electricidad' },
    { nombre: 'Roberto Díaz', cargo: 'Peón', especialidad: 'General' },
    { nombre: 'Carmen Silva', cargo: 'Operario', especialidad: 'Fontanería' },
    { nombre: 'Miguel Torres', cargo: 'Capataz', especialidad: 'Supervisión' }
  ];
  
  return NextResponse.json({
    reportes,
    actividades,
    trabajadores
  });
}
