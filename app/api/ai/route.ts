// app/api/ai/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { analizarDatosConstruccion } from '@/services/geminiClient';
import { getBigQueryAIAnalytics } from '@/services/bigQueryClient';
import { extractSectionFromText, detectTrend } from '@/utils/aiHelpers';
import { AIAnalysisResult, AIAnalysisInsights } from '@/utils/types';

// Función para preparar el contexto para la IA a partir de los datos de BigQuery
function prepareAIContext(bigQueryData: any): string {
  if (!bigQueryData.reportes || bigQueryData.reportes.length === 0) {
    return "No hay datos suficientes para realizar un análisis.";
  }

  const { reportes, actividades, trabajadores } = bigQueryData;
  const totalReportes = reportes.length;
  const uniqueActividades = new Set(actividades?.map((a: any) => a.actividad_proceso) || []).size;
  const uniqueTrabajadores = new Set(trabajadores?.map((t: any) => t.trabajador_nombre) || []).size;

  const costoTotal = reportes.reduce((sum: number, r: any) => sum + (Number(r.costo_total) || 0), 0);
  const productividadTotal = reportes.reduce((sum: number, r: any) => sum + (Number(r.productividad) || 0), 0);
  const productividadPromedio = totalReportes > 0 ? productividadTotal / totalReportes : 0;

  return `
Datos de construcción para análisis:
- Total de reportes: ${totalReportes}
- Actividades distintas: ${uniqueActividades}
- Trabajadores involucrados: ${uniqueTrabajadores}
- Costo total del período: S/ ${costoTotal.toFixed(2)}
- Productividad promedio general: ${productividadPromedio.toFixed(2)}

Actividades más relevantes (Top 5 por valor):
${(actividades || []).slice(0, 5).map((a: any) => `- ${a.actividad_proceso || 'N/A'}: Valor S/ ${(a.valor_total || 0).toFixed(2)}, Productividad ${(a.productividad_promedio || 0).toFixed(2)}`).join('\n')}

Trabajadores con mayor productividad (Top 5):
${(trabajadores || []).slice(0, 5).map((t: any) => `- ${t.trabajador_nombre || 'N/A'} (${t.trabajador_categoria || 'N/A'}): Productividad ${(t.productividad_promedio || 0).toFixed(2)}`).join('\n')}
`;
}

// Manejador de la solicitud POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filters, tipoAnalisis = "general", promptPersonalizado } = body;

    if (!filters || !filters.inicio || !filters.fin) {
      return NextResponse.json(
        { error: "Se requieren los filtros de fecha (inicio y fin)." },
        { status: 400 }
      );
    }

    console.log(`API IA: Obteniendo datos de BigQuery para el período ${filters.inicio} a ${filters.fin}`);
    
    // Obtener datos de BigQuery con manejo de errores
    let bigQueryData;
    try {
      bigQueryData = await getBigQueryAIAnalytics(filters.inicio, filters.fin, { detalle: true });
    } catch (error: any) {
      console.error('Error obteniendo datos de BigQuery:', error);
      return NextResponse.json(
        { error: "Error al obtener datos de BigQuery: " + error.message },
        { status: 502 }
      );
    }

    if (!bigQueryData.reportes || bigQueryData.reportes.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron datos suficientes en BigQuery para realizar el análisis." },
        { status: 404 }
      );
    }
    
    const aiContext = prepareAIContext(bigQueryData);
    
    let prompt = "";
    switch (tipoAnalisis) {
        case "productividad":
            prompt = `Analiza los datos de construcción enfocándote en PRODUCTIVIDAD. Identifica los trabajadores más eficientes, cuellos de botella y da recomendaciones para optimizar. Contexto: ${aiContext}`;
            break;
        case "costos":
            prompt = `Analiza los datos de construcción enfocándote en COSTOS. Identifica sobrecostos, oportunidades de ahorro y da recomendaciones para optimizar. Contexto: ${aiContext}`;
            break;
        case "tendencias":
            prompt = `Analiza las TENDENCIAS en los datos de construcción. Identifica patrones temporales, evolución de métricas y proyecciones. Contexto: ${aiContext}`;
            break;
        case "recomendaciones":
            prompt = `Proporciona RECOMENDACIONES específicas basadas en los datos de construcción. Enfócate en acciones concretas y mejoras implementables. Contexto: ${aiContext}`;
            break;
        case "personalizado":
            if (promptPersonalizado) {
                prompt = `${promptPersonalizado}\n\nContexto de datos:\n${aiContext}`;
            } else {
                prompt = `Realiza un análisis general de los siguientes datos de construcción. Proporciona hallazgos, tendencias y recomendaciones. Contexto: ${aiContext}`;
            }
            break;
        default:
            prompt = `Realiza un análisis general de los siguientes datos de construcción. Proporciona hallazgos, tendencias y recomendaciones. Contexto: ${aiContext}`;
    }

    console.log("API IA: Enviando solicitud a Gemini...");
    
    // Llamar al servicio de Gemini con manejo de errores
    let aiResponse;
    try {
      aiResponse = await analizarDatosConstruccion(aiContext, { 
        mode: 'api', 
        tipo: tipoAnalisis as any,
        customPrompt: prompt 
      });
    } catch (error: any) {
      console.error('Error con Gemini:', error);
      return NextResponse.json(
        { error: "Error al procesar con IA: " + error.message },
        { status: 503 }
      );
    }

    const aiResponseText = aiResponse.texto || '';

    // Procesar la respuesta para extraer insights estructurados
    const insights: AIAnalysisInsights = {
      mainPoints: extractSectionFromText(aiResponseText, ["puntos principales", "hallazgos clave", "resumen ejecutivo"]),
      recommendations: extractSectionFromText(aiResponseText, ["recomendaciones", "sugerencias", "acciones"]),
      productivityTrend: detectTrend(aiResponseText, "productividad") as any,
      costTrend: detectTrend(aiResponseText, "costo") as any,
      keyActivities: extractSectionFromText(aiResponseText, ["actividades clave", "actividades principales"])
    };

    // Asegurar que las tendencias tengan valores válidos
    if (!['aumentando', 'disminuyendo', 'estable'].includes(insights.productivityTrend)) {
      insights.productivityTrend = 'estable';
    }
    if (!['aumentando', 'disminuyendo', 'estable'].includes(insights.costTrend)) {
      insights.costTrend = 'estable';
    }

    const result: AIAnalysisResult = {
      text: aiResponseText,
      insights,
      dataTimestamp: new Date().toISOString(),
      queryType: tipoAnalisis
    };
    
    console.log("API IA: Análisis completado exitosamente");
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error general en la ruta /api/ai:", error);
    return NextResponse.json(
      { 
        error: `Error en el servidor de IA: ${error.message}`,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}