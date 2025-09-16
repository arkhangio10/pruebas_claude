// app/api/ai/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIAnalysisResult, AIAnalysisInsights } from '@/utils/types';

// Inicializar clientes de BigQuery y Gemini (se hace una sola vez)
const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID || 'pruebas-9e15f',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credenciales.json'
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Función para obtener los datos detallados directamente de BigQuery
async function getDetailedBigQueryData(fechaInicio: string, fechaFin: string) {
  const query = `
    SELECT
      fecha,
      reporte_id,
      elaborado_por,
      actividad_proceso,
      metrado_ejecutado,
      valor_metrado,
      trabajador_nombre,
      trabajador_categoria,
      horas_trabajadas,
      costo_total,
      productividad,
      ganancia
    FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
    WHERE fecha BETWEEN @fechaInicio AND @fechaFin
    LIMIT 1000; -- Limitar para no exceder el contexto de la IA
  `;

  const options = {
    query: query,
    params: { fechaInicio, fechaFin },
  };

  const [rows] = await bigquery.query(options);
  return rows;
}

// Función para preparar el contexto para Gemini
function prepareAIContext(data: any[], filters: { inicio: string, fin: string }): string {
  const summary = {
    reportes: new Set(data.map(r => r.reporte_id)).size,
    trabajadores: new Set(data.map(r => r.trabajador_nombre)).size,
    actividades: new Set(data.map(r => r.actividad_proceso)).size,
    costoTotal: data.reduce((sum, r) => sum + (r.costo_total || 0), 0),
    valorTotal: data.reduce((sum, r) => sum + (r.valor_metrado || 0), 0),
    productividadPromedio: data.reduce((sum, r) => sum + (r.productividad || 0), 0) / (data.length || 1)
  };

  return `
    Análisis de datos de construcción para HERGONSA en el período de ${filters.inicio} a ${filters.fin}:

    Resumen General:
    - Reportes únicos: ${summary.reportes}
    - Trabajadores activos: ${summary.trabajadores}
    - Actividades distintas: ${summary.actividades}
    - Costo Total Mano de Obra: S/ ${summary.costoTotal.toFixed(2)}
    - Valor Total Producido: S/ ${summary.valorTotal.toFixed(2)}
    - Productividad Promedio: ${summary.productividadPromedio.toFixed(2)}

    Muestra de Datos Detallados (primeros 20 registros):
    ${JSON.stringify(data.slice(0, 20), null, 2)}
  `;
}

// Función para extraer secciones del texto de la IA
function extractSection(text: string, titleKeywords: string[]): string[] {
    const lines = text.split('\n');
    let sectionLines: string[] = [];
    let inSection = false;

    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (titleKeywords.some(keyword => lowerLine.includes(keyword))) {
            inSection = true;
            continue;
        }

        if (inSection) {
            if (line.trim().startsWith('* ') || line.trim().startsWith('- ') || line.match(/^\d+\.\s/)) {
                sectionLines.push(line.trim().substring(2));
            } else if (line.trim() === '') {
                inSection = false;
            }
        }
    }
    return sectionLines.length > 0 ? sectionLines : text.split('\n').slice(1, 4);
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filters, tipoAnalisis = "general", promptPersonalizado } = body;

    if (!filters || !filters.inicio || !filters.fin) {
      return NextResponse.json({ error: "Se requieren los filtros de fecha (inicio y fin)." }, { status: 400 });
    }

    console.log(`API IA: Obteniendo datos de BigQuery (tabla detallada) para el período ${filters.inicio} a ${filters.fin}`);
    const bigQueryData = await getDetailedBigQueryData(filters.inicio, filters.fin);

    if (bigQueryData.length === 0) {
      return NextResponse.json({ error: "No se encontraron datos en BigQuery para el análisis." }, { status: 404 });
    }

    const aiContext = prepareAIContext(bigQueryData, filters);

    const prompt = promptPersonalizado || `Realiza un análisis de tipo '${tipoAnalisis}' con los siguientes datos. Responde en español, de forma clara y estructurada para un supervisor de obra.`;

    const fullPrompt = `${prompt}\n\nContexto de datos:\n${aiContext}`;

    console.log("API IA: Enviando solicitud a Gemini...");
    
    // *** LA CORRECCIÓN ESTÁ AQUÍ ***
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }); 
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const aiResponseText = response.text();

    const insights: AIAnalysisInsights = {
      mainPoints: extractSection(aiResponseText, ["hallazgos", "puntos principales"]),
      recommendations: extractSection(aiResponseText, ["recomendaciones", "acciones"]),
      productivityTrend: 'estable', // Placeholder, se puede mejorar la detección
      costTrend: 'estable', // Placeholder
      keyActivities: [] // Placeholder
    };

    const finalResult: AIAnalysisResult = {
      text: aiResponseText,
      insights,
      dataTimestamp: new Date().toISOString(),
      queryType: tipoAnalisis
    };

    console.log("API IA: Análisis completado exitosamente");
    return NextResponse.json(finalResult);

  } catch (error: any) {
    console.error("Error general en la ruta /api/ai:", error);
    return NextResponse.json(
      { error: `Error en el servidor de IA: ${error.message}` },
      { status: 500 }
    );
  }
}