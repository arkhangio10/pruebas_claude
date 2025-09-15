// Simulación de cliente BigQuery con fallback a Cloud Function
export interface BigQueryAnalyticsResult {
  reportes: any[];
  actividades: any[];
  trabajadores: any[];
}

export interface BigQueryAIAnalyticsResult {
  reportes: any[];
  actividades: any[];
  trabajadores: any[];
  metricas: any[];
  tendencias: any[];
  insights: any[];
}

const ENDPOINT = process.env.NEXT_PUBLIC_BIGQUERY_FUNCTION_URL || 'https://us-central1-pruebas-9e15f.cloudfunctions.net/obtenerMetricasPeriodo';
const AI_ENDPOINT = process.env.NEXT_PUBLIC_BIGQUERY_AI_FUNCTION_URL || 'https://us-central1-pruebas-9e15f.cloudfunctions.net';

export async function getBigQueryAnalytics(inicio: string, fin: string): Promise<BigQueryAnalyticsResult> {
  if (!ENDPOINT) {
    console.error('No se encontró la URL del endpoint de BigQuery en las variables de entorno');
    return { reportes: [], actividades: [], trabajadores: [] };
  }
  
  console.log(`Conectando a BigQuery en: ${ENDPOINT}?inicio=${inicio}&fin=${fin}`);
  
  try {
    const res = await fetch(`${ENDPOINT}?inicio=${inicio}&fin=${fin}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error en BigQuery API: ${res.status} - ${errorText}`);
      throw new Error(`Error BigQuery: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Datos de BigQuery recibidos:', {
      reportes: data.reportes?.length || 0,
      actividades: data.actividades?.length || 0,
      trabajadores: data.trabajadores?.length || 0
    });
    
    // Verificación adicional - Mostrar una muestra de los datos recibidos
    if (data.reportes?.length > 0) {
      console.log('Muestra de reporte:', {
        id: data.reportes[0].id || 'N/A',
        fecha: data.reportes[0].fecha || 'N/A',
        elaborado_por: data.reportes[0].elaborado_por || data.reportes[0].elaboradoPor || 'N/A'
      });
    }
    
    if (data.actividades?.length > 0) {
      console.log('Muestra de actividad:', {
        nombre: data.actividades[0].nombre || 'N/A',
        metrado: data.actividades[0].metradoE || data.actividades[0].metrado_ejecutado || 'N/A'
      });
    }
    
    // Confirmar que los datos son de BigQuery
    console.log('✅ Datos obtenidos correctamente de BigQuery');
    
    return data;
  } catch (error) {
    console.error('Error conectando con BigQuery:', error);
    throw error;
  }
}

export async function getBigQueryAIAnalytics(inicio: string, fin: string, options?: { detalle?: boolean }): Promise<BigQueryAIAnalyticsResult> {
  if (!AI_ENDPOINT) {
    console.error('No se encontró la URL del endpoint de BigQuery AI en las variables de entorno');
    return { reportes: [], actividades: [], trabajadores: [], metricas: [], tendencias: [], insights: [] };
  }
  
  const queryParams = new URLSearchParams({
    inicio,
    fin,
    detalle: options?.detalle ? '1' : '0'
  });
  
  // Construye la URL de forma segura sin usar 'window'
  const endpointUrl = new URL(AI_ENDPOINT);
  endpointUrl.pathname += '/ai';
  endpointUrl.search = queryParams.toString();

  const url = endpointUrl.toString();
  console.log(`Conectando a BigQuery AI en: ${url}`);
  
  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Error en BigQuery AI API: ${res.status} - ${errorText}`);
      throw new Error(`Error BigQuery AI: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Datos de BigQuery AI recibidos:', {
      reportes: data.reportes?.length || 0,
      insights: data.insights?.length || 0
    });
    
    return data;
  } catch (error) {
    console.error('Error conectando con BigQuery AI:', error);
    throw error;
  }
}
