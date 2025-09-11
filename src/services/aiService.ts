import { BigQueryRow, AIAnalysisInsights } from "../utils/types";
import { getBigQueryAIAnalytics } from "./bigQueryClient";
import { extractSectionFromText, detectTrend } from "../utils/aiHelpers";

/**
 * Servicio para interactuar con la IA y procesar datos de BigQuery
 */
export class AIService {
  /**
   * Obtiene datos de BigQuery para análisis de IA
   */
  static async getBigQueryDataForAI(filters: {inicio: string, fin: string}): Promise<{
    data: BigQueryRow[];
    summary: {
      reportes: number;
      actividades: number;
      trabajadores: number;
      costoTotal: number;
      productividadPromedio: number;
    }
  }> {
    try {
      console.log("AIService: Obteniendo datos de BigQuery para análisis...");
      const results = await getBigQueryAIAnalytics(filters.inicio, filters.fin, { detalle: true });
      
      if (!results || !results.reportes || !Array.isArray(results.reportes)) {
        console.error("AIService: No se recibieron datos válidos de BigQuery", results);
        throw new Error("No se recibieron datos válidos de BigQuery");
      }
      
      const dataRows = results.reportes;
      console.log(`AIService: Se obtuvieron ${dataRows.length} registros de BigQuery`);
      
      // Calcular métricas del resumen
      const summary = {
        reportes: new Set(dataRows.map(row => row.id_reporte)).size,
        actividades: new Set(dataRows.map(row => row.actividad)).size,
        trabajadores: new Set(dataRows.map(row => row.rut_trabajador)).size,
        costoTotal: dataRows.reduce((sum, row) => sum + (Number(row.costo) || 0), 0),
        productividadPromedio: dataRows.reduce((sum, row) => sum + (Number(row.productividad) || 0), 0) / 
                             (dataRows.length || 1)
      };
      
      console.log("AIService: Resumen calculado", summary);
      
      return {
        data: dataRows as BigQueryRow[],
        summary
      };
    } catch (error) {
      console.error("AIService: Error al obtener datos para análisis de IA", error);
      throw error;
    }
  }

  /**
   * Prepara el contexto para el análisis de IA
   */
  static prepareAIContext(data: BigQueryRow[], summary: any): string {
    // Preparar actividades por cantidad de horas
    const actividadesPorHoras: Record<string, number> = {};
    data.forEach(row => {
      const actividad = row.actividad || 'Sin especificar';
      actividadesPorHoras[actividad] = (actividadesPorHoras[actividad] || 0) + (Number(row.horas) || 0);
    });

    // Preparar trabajadores por productividad
    const trabajadoresPorProductividad: Record<string, number> = {};
    data.forEach(row => {
      const trabajador = row.nombre_trabajador || 'Sin especificar';
      trabajadoresPorProductividad[trabajador] = (trabajadoresPorProductividad[trabajador] || 0) + (Number(row.productividad) || 0);
    });

    // Calcular productividad por actividad
    const productividadPorActividad: Record<string, number> = {};
    const conteoActividadPorProductividad: Record<string, number> = {};
    data.forEach(row => {
      const actividad = row.actividad || 'Sin especificar';
      productividadPorActividad[actividad] = (productividadPorActividad[actividad] || 0) + (Number(row.productividad) || 0);
      conteoActividadPorProductividad[actividad] = (conteoActividadPorProductividad[actividad] || 0) + 1;
    });

    // Calcular el promedio
    Object.keys(productividadPorActividad).forEach(key => {
      if (conteoActividadPorProductividad[key]) {
        productividadPorActividad[key] = productividadPorActividad[key] / conteoActividadPorProductividad[key];
      }
    });

    // Construir el contexto para la IA
    return `
Datos de construcción para análisis:
- Total de reportes analizados: ${summary.reportes}
- Total de actividades distintas: ${summary.actividades}
- Total de trabajadores: ${summary.trabajadores}
- Costo total registrado: $${summary.costoTotal.toFixed(2)}
- Productividad promedio: ${summary.productividadPromedio.toFixed(2)}

Actividades más significativas por horas trabajadas:
${Object.entries(actividadesPorHoras)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .slice(0, 5)
  .map(([actividad, horas]) => `- ${actividad}: ${horas.toFixed(2)} horas`)
  .join('\n')}

Trabajadores destacados por productividad:
${Object.entries(trabajadoresPorProductividad)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .slice(0, 5)
  .map(([trabajador, prod]) => `- ${trabajador}: ${prod.toFixed(2)}`)
  .join('\n')}

Productividad promedio por actividad:
${Object.entries(productividadPorActividad)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .slice(0, 5)
  .map(([actividad, prod]) => `- ${actividad}: ${prod.toFixed(2)}`)
  .join('\n')}
`;
  }
  
  /**
   * Extrae insights clave del texto generado por la IA
   */
  static extractInsights(aiText: string): AIAnalysisInsights {
    return {
      mainPoints: extractSectionFromText(aiText, ["puntos principales", "hallazgos clave", "resultados principales"]),
      recommendations: extractSectionFromText(aiText, ["recomendaciones", "sugerencias", "acciones recomendadas"]),
      productivityTrend: detectTrend(aiText, "productividad"),
      costTrend: detectTrend(aiText, "costo"),
      keyActivities: extractSectionFromText(aiText, ["actividades clave", "actividades principales"])
    };
  }
}

// Ya no necesitamos estas funciones aquí ya que ahora están en aiHelpers.ts
