import { NextApiRequest, NextApiResponse } from 'next';
import { BigQuery } from '@google-cloud/bigquery';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializar BigQuery
const bigquery = new BigQuery({
  projectId: 'pruebas-9e15f',
  keyFilename: './credenciales.json'
});

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Tipos de análisis disponibles
const ANALYSIS_PROMPTS = {
  general: `Analiza estos datos de construcción del proyecto HERGONSA:
    - Identifica patrones clave en productividad y costos
    - Detecta anomalías o problemas potenciales
    - Proporciona recomendaciones específicas y accionables
    - Describe tendencias importantes
    
    Responde en español técnico para supervisores de obra. 
    Estructura tu respuesta con secciones claras.`,
    
  costos: `Analiza estos costos de construcción del proyecto HERGONSA:
    - Identifica áreas con sobrecostos
    - Encuentra oportunidades de ahorro
    - Analiza la eficiencia del gasto por categoría de trabajador
    - Proporciona recomendaciones específicas
    
    Responde en español para gerentes y supervisores.`,
    
  productividad: `Analiza la productividad en construcción del proyecto HERGONSA:
    - Identifica trabajadores y equipos más eficientes
    - Detecta cuellos de botella en los procesos
    - Analiza productividad por actividad
    - Proporciona recomendaciones para optimizar
    
    Responde en español técnico para supervisores.`,
    
  tendencias: `Analiza las tendencias temporales en los datos de construcción HERGONSA:
    - Identifica tendencias de productividad
    - Analiza evolución de costos
    - Detecta patrones estacionales o cíclicos
    - Proyecta posibles escenarios futuros
    
    Responde en español con enfoque analítico.`,
    
  recomendaciones: `Basándote en los datos de construcción HERGONSA, proporciona:
    - Top 5 recomendaciones prioritarias para mejorar productividad
    - Acciones específicas para reducir costos
    - Sugerencias para optimizar asignación de recursos
    - Mejoras en procesos y flujos de trabajo
    
    Sé específico y práctico en las recomendaciones.`,
    
  personalizado: '' // Se llenará con el prompt del usuario
};

// Función para obtener datos de BigQuery
async function obtenerDatosBigQuery(fechaInicio: string, fechaFin: string) {
  try {
    // Query para obtener resumen de datos
    const query = `
      WITH resumen_general AS (
        SELECT 
          COUNT(DISTINCT reporte_id) as total_reportes,
          COUNT(DISTINCT trabajador_nombre) as total_trabajadores,
          COUNT(DISTINCT actividad_proceso) as total_actividades,
          SUM(metrado_ejecutado) as metrado_total,
          SUM(horas_trabajadas) as horas_totales,
          SUM(costo_total) as costo_total,
          SUM(valor_metrado) as valor_total,
          AVG(productividad) as productividad_promedio,
          SUM(ganancia) as ganancia_total
        FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
        WHERE fecha BETWEEN @fechaInicio AND @fechaFin
      ),
      top_actividades AS (
        SELECT 
          actividad_proceso,
          SUM(metrado_ejecutado) as metrado,
          SUM(horas_trabajadas) as horas,
          AVG(productividad) as productividad,
          SUM(valor_metrado) as valor
        FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
        WHERE fecha BETWEEN @fechaInicio AND @fechaFin
        GROUP BY actividad_proceso
        ORDER BY valor DESC
        LIMIT 10
      ),
      top_trabajadores AS (
        SELECT 
          trabajador_nombre,
          trabajador_categoria,
          SUM(horas_trabajadas) as horas,
          SUM(metrado_ejecutado) as metrado,
          AVG(productividad) as productividad,
          SUM(costo_total) as costo
        FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
        WHERE fecha BETWEEN @fechaInicio AND @fechaFin
        GROUP BY trabajador_nombre, trabajador_categoria
        ORDER BY productividad DESC
        LIMIT 10
      ),
      tendencia_diaria AS (
        SELECT 
          fecha,
          SUM(metrado_ejecutado) as metrado_dia,
          SUM(horas_trabajadas) as horas_dia,
          SUM(costo_total) as costo_dia,
          AVG(productividad) as productividad_dia
        FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
        WHERE fecha BETWEEN @fechaInicio AND @fechaFin
        GROUP BY fecha
        ORDER BY fecha
      )
      SELECT 
        (SELECT AS STRUCT * FROM resumen_general) as resumen,
        ARRAY(SELECT AS STRUCT * FROM top_actividades) as actividades,
        ARRAY(SELECT AS STRUCT * FROM top_trabajadores) as trabajadores,
        ARRAY(SELECT AS STRUCT * FROM tendencia_diaria) as tendencia
    `;

    const options = {
      query: query,
      params: {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin
      }
    };

    const [rows] = await bigquery.query(options);
    return rows[0];
  } catch (error) {
    console.error('Error consultando BigQuery:', error);
    throw error;
  }
}

// Función para procesar con Gemini
async function analizarConGemini(datos: any, tipoAnalisis: string, promptPersonalizado?: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Preparar el prompt
    let prompt = ANALYSIS_PROMPTS[tipoAnalisis as keyof typeof ANALYSIS_PROMPTS] || ANALYSIS_PROMPTS.general;
    
    if (tipoAnalisis === 'personalizado' && promptPersonalizado) {
      prompt = promptPersonalizado;
    }
    
    // Formatear los datos para el análisis
    const datosFormateados = `
DATOS DEL PROYECTO HERGONSA
Período: ${datos.periodo || 'No especificado'}

RESUMEN GENERAL:
- Reportes procesados: ${datos.resumen?.total_reportes || 0}
- Trabajadores activos: ${datos.resumen?.total_trabajadores || 0}
- Actividades realizadas: ${datos.resumen?.total_actividades || 0}
- Metrado total ejecutado: ${datos.resumen?.metrado_total?.toFixed(2) || 0}
- Horas totales trabajadas: ${datos.resumen?.horas_totales?.toFixed(2) || 0}
- Costo total MO: S/ ${datos.resumen?.costo_total?.toFixed(2) || 0}
- Valor total producido: S/ ${datos.resumen?.valor_total?.toFixed(2) || 0}
- Productividad promedio: ${datos.resumen?.productividad_promedio?.toFixed(2) || 0}
- Ganancia total: S/ ${datos.resumen?.ganancia_total?.toFixed(2) || 0}

TOP 10 ACTIVIDADES POR VALOR:
${datos.actividades?.map((a: any, i: number) => 
  `${i+1}. ${a.actividad_proceso}: Metrado ${a.metrado?.toFixed(2)}, Valor S/ ${a.valor?.toFixed(2)}, Productividad ${a.productividad?.toFixed(2)}`
).join('\n') || 'Sin datos'}

TOP 10 TRABAJADORES POR PRODUCTIVIDAD:
${datos.trabajadores?.map((t: any, i: number) => 
  `${i+1}. ${t.trabajador_nombre} (${t.trabajador_categoria}): Productividad ${t.productividad?.toFixed(2)}, Horas ${t.horas?.toFixed(2)}, Metrado ${t.metrado?.toFixed(2)}`
).join('\n') || 'Sin datos'}

TENDENCIA TEMPORAL (últimos días):
${datos.tendencia?.slice(-7).map((d: any) => 
  `${d.fecha}: Metrado ${d.metrado_dia?.toFixed(2)}, Productividad ${d.productividad_dia?.toFixed(2)}, Costo S/ ${d.costo_dia?.toFixed(2)}`
).join('\n') || 'Sin datos'}
`;

    const promptCompleto = `${prompt}\n\nDATOS A ANALIZAR:\n${datosFormateados}`;
    
    // Generar respuesta con Gemini
    const result = await model.generateContent(promptCompleto);
    const response = await result.response;
    const text = response.text();
    
    // Extraer insights del texto
    const insights = extraerInsights(text);
    
    return {
      text,
      insights
    };
  } catch (error) {
    console.error('Error con Gemini:', error);
    throw error;
  }
}

// Función auxiliar para extraer insights estructurados
function extraerInsights(text: string) {
  const lines = text.split('\n');
  const insights = {
    mainPoints: [] as string[],
    recommendations: [] as string[],
    productivityTrend: 'estable' as string,
    costTrend: 'estable' as string
  };
  
  // Detectar tendencias
  if (text.toLowerCase().includes('productividad aumenta') || 
      text.toLowerCase().includes('productividad mejora')) {
    insights.productivityTrend = 'aumentando';
  } else if (text.toLowerCase().includes('productividad disminuy') || 
             text.toLowerCase().includes('productividad empeora')) {
    insights.productivityTrend = 'disminuyendo';
  }
  
  if (text.toLowerCase().includes('costos aumenta') || 
      text.toLowerCase().includes('costos sube')) {
    insights.costTrend = 'aumentando';
  } else if (text.toLowerCase().includes('costos disminuy') || 
             text.toLowerCase().includes('costos baja')) {
    insights.costTrend = 'disminuyendo';
  }
  
  // Extraer puntos principales y recomendaciones
  let inMainPoints = false;
  let inRecommendations = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.toLowerCase().includes('puntos principales') || 
        trimmedLine.toLowerCase().includes('hallazgos clave')) {
      inMainPoints = true;
      inRecommendations = false;
      continue;
    }
    
    if (trimmedLine.toLowerCase().includes('recomendacion')) {
      inMainPoints = false;
      inRecommendations = true;
      continue;
    }
    
    if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || 
        trimmedLine.match(/^\d+\./)) {
      const cleanLine = trimmedLine.replace(/^[-•\d.]\s*/, '').trim();
      
      if (inMainPoints && cleanLine.length > 10) {
        insights.mainPoints.push(cleanLine);
      } else if (inRecommendations && cleanLine.length > 10) {
        insights.recommendations.push(cleanLine);
      }
    }
  }
  
  // Si no se encontraron insights estructurados, extraer automáticamente
  if (insights.mainPoints.length === 0) {
    // Tomar las primeras 3 líneas significativas como puntos principales
    const significantLines = lines
      .filter(l => l.trim().length > 30 && !l.trim().startsWith('#'))
      .slice(0, 3);
    insights.mainPoints = significantLines;
  }
  
  if (insights.recommendations.length === 0) {
    // Buscar líneas que contengan palabras clave de recomendación
    const recLines = lines.filter(l => 
      l.toLowerCase().includes('debe') || 
      l.toLowerCase().includes('recomiend') || 
      l.toLowerCase().includes('sugier') ||
      l.toLowerCase().includes('mejor')
    ).slice(0, 3);
    insights.recommendations = recLines.map(l => l.trim());
  }
  
  return insights;
}

// Handler principal de la API
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { 
      filters, 
      tipoAnalisis = 'general', 
      promptPersonalizado 
    } = req.body;

    if (!filters?.inicio || !filters?.fin) {
      return res.status(400).json({ 
        error: 'Se requieren fechas de inicio y fin' 
      });
    }

    console.log('Procesando análisis IA:', {
      periodo: `${filters.inicio} a ${filters.fin}`,
      tipo: tipoAnalisis
    });

    // Obtener datos de BigQuery
    const datosBigQuery = await obtenerDatosBigQuery(
      filters.inicio, 
      filters.fin
    );

    // Añadir el período a los datos
    const datosConPeriodo = {
      ...datosBigQuery,
      periodo: `${filters.inicio} a ${filters.fin}`
    };

    // Analizar con Gemini
    const analisis = await analizarConGemini(
      datosConPeriodo, 
      tipoAnalisis, 
      promptPersonalizado
    );

    // Preparar respuesta
    const response = {
      text: analisis.text,
      insights: analisis.insights,
      metadata: {
        periodo: `${filters.inicio} a ${filters.fin}`,
        registrosAnalizados: datosBigQuery.resumen?.total_reportes || 0,
        fuenteDatos: 'BigQuery'
      },
      dataTimestamp: new Date().toISOString(),
      queryType: tipoAnalisis
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Error en análisis IA:', error);
    
    return res.status(500).json({ 
      error: error.message || 'Error al procesar análisis de IA',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}