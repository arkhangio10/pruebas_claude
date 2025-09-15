import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import admin from 'firebase-admin';
import { BigQuery } from '@google-cloud/bigquery';

// Verificar que las variables de entorno críticas existan
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'BIGQUERY_PROJECT_ID',
  'GEMINI_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Variable de entorno faltante: ${envVar}`);
  }
}

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// Inicializar BigQuery usando variables de entorno
const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
  credentials: process.env.BIGQUERY_CREDENTIALS 
    ? JSON.parse(process.env.BIGQUERY_CREDENTIALS) 
    : undefined
});

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Definición de interfaces para estructuras de datos
// Tipos de análisis disponibles
type TipoAnalisis = 'general' | 'costos' | 'productividad' | 'tendencias' | 'recomendaciones' | 'personalizado';

// Interfaces para datos y solicitudes
interface QueryFilters {
  inicio: string;
  fin: string;
}

interface AnalysisRequest {
  filters: QueryFilters;
  tipoAnalisis: TipoAnalisis;
  promptPersonalizado?: string;
}

// Interfaces para los resultados de las consultas
interface CostoCategoria {
  trabajador_categoria: string;
  num_trabajadores: number;
  total_horas: number;
  costo_total: number;
  metrado_total: number;
  productividad_promedio: number;
  ganancia_total: number;
}

interface Actividad {
  actividad_proceso: string;
  actividad_und: string;
  metrado_total: number;
  metrado_programado: number;
  horas_totales: number;
  costo_actividad: number;
  valor_total: number;
  ganancia_actividad: number;
  productividad_promedio: number;
  trabajadores_involucrados: number;
}

interface Trabajador {
  trabajador_nombre: string;
  trabajador_categoria: string;
  total_horas: number;
  metrado_total: number;
  productividad_promedio: number;
  costo_trabajador: number;
  ganancia_generada: number;
}

interface CostosResultado {
  costos_por_categoria?: string;
  top_actividades?: string;
  top_trabajadores?: string;
  valor_total_periodo?: number;
  costo_total_periodo?: number;
  ganancia_total_periodo?: number;
}

interface TendenciaDiaria {
  fecha: string;
  metrado_dia: number;
  horas_dia: number;
  costo_dia: number;
  valor_dia: number;
  productividad_dia: number;
  trabajadores_dia: number;
  metrado_dia_anterior?: number;
  productividad_dia_anterior?: number;
  productividad_promedio_7d?: number;
}

interface ProductividadDetalle {
  trabajador_nombre: string;
  trabajador_categoria: string;
  actividad_proceso: string;
  fecha: string;
  horas_trabajadas: number;
  metrado_ejecutado: number;
  metrado_programado: number;
  productividad: number;
  nivel_productividad: string;
  eficiencia_actividad: number;
  valor_metrado: number;
  costo_total: number;
  ganancia: number;
}

interface ResumenGeneral {
  fecha: string;
  elaborado_por: string;
  num_reportes: number;
  num_trabajadores: number;
  num_actividades: number;
  total_horas: number;
  total_metrado_ejecutado: number;
  total_metrado_programado: number;
  total_valorizado: number;
  total_costo_mo: number;
  ganancia_total: number;
  productividad_promedio: number;
}

// Interfaces para la respuesta procesada
interface AnalisisInsights {
  mainPoints: string[];
  recommendations: string[];
  productivityTrend: 'aumentando' | 'disminuyendo' | 'estable';
  costTrend: 'aumentando' | 'disminuyendo' | 'estable';
  keyActivities?: string[];
}

interface AnalisisMetadata {
  periodo: string;
  registrosAnalizados: number;
  fuenteDatos: string;
}

interface AnalisisRespuesta {
  text: string;
  insights: AnalisisInsights;
  dataTimestamp: string;
  queryType: TipoAnalisis;
  metadata: AnalisisMetadata;
}

// Plantillas de prompts optimizados para construcción
const PROMPTS_CONSTRUCCION: Record<Exclude<TipoAnalisis, 'personalizado'>, string> = {
  general: `Eres un experto supervisor de obra con 20 años de experiencia. Analiza estos datos de construcción del proyecto HERGONSA:

DATOS DEL PROYECTO:
{data}

Por favor proporciona:
1. RESUMEN EJECUTIVO (3-4 líneas clave)
2. HALLAZGOS PRINCIPALES (5 puntos más importantes)
3. ANÁLISIS DE PRODUCTIVIDAD
   - Trabajadores más productivos
   - Actividades más eficientes
   - Áreas de mejora
4. ANÁLISIS DE COSTOS
   - Relación costo-beneficio por actividad
   - Desviaciones significativas
5. RECOMENDACIONES ACCIONABLES (5 más importantes)
6. TENDENCIAS OBSERVADAS

Usa terminología técnica de construcción en español. Sé específico con nombres y números.`,

  costos: `Como gerente financiero de construcción, analiza estos datos de costos del proyecto HERGONSA:

DATOS FINANCIEROS:
{data}

Proporciona:
1. ANÁLISIS DE COSTOS POR CATEGORÍA
   - Operarios: S/ {costoOperario}
   - Oficiales: S/ {costoOficial} 
   - Peones: S/ {costoPeon}
2. ACTIVIDADES CON MAYOR IMPACTO ECONÓMICO
3. ANÁLISIS DE GANANCIA/PÉRDIDA
4. EFICIENCIA DEL GASTO (ROI por actividad)
5. IDENTIFICACIÓN DE SOBRECOSTOS
6. OPORTUNIDADES DE AHORRO (cuantificadas)
7. RECOMENDACIONES FINANCIERAS

Incluye valores monetarios específicos en soles peruanos.`,

  productividad: `Como ingeniero de productividad en construcción, analiza estos datos del proyecto HERGONSA:

MÉTRICAS DE PRODUCTIVIDAD:
{data}

Analiza:
1. RANKING DE PRODUCTIVIDAD POR TRABAJADOR
2. ANÁLISIS POR ACTIVIDAD
   - Metrado ejecutado vs programado
   - Horas hombre por actividad
   - Rendimientos reales
3. COMPARACIÓN POR CATEGORÍAS
   - Productividad Operarios vs Oficiales vs Peones
4. IDENTIFICACIÓN DE CUELLOS DE BOTELLA
5. FACTORES QUE AFECTAN LA PRODUCTIVIDAD
6. RECOMENDACIONES PARA OPTIMIZACIÓN
7. PROYECCIÓN DE MEJORAS (con %)

Usa métricas específicas: m²/hora, m³/día, etc.`,

  tendencias: `Como analista de datos de construcción, identifica tendencias en el proyecto HERGONSA:

DATOS HISTÓRICOS:
{data}

Identifica:
1. TENDENCIAS TEMPORALES
   - Evolución diaria/semanal/mensual
   - Patrones recurrentes
2. TENDENCIAS DE PRODUCTIVIDAD
   - ¿Mejorando o empeorando?
   - Tasa de cambio
3. TENDENCIAS DE COSTOS
   - Inflación de costos
   - Variaciones por categoría
4. PREDICCIONES
   - Proyección próximo mes
   - Riesgos identificados
5. CORRELACIONES ENCONTRADAS
6. ANOMALÍAS DETECTADAS

Incluye gráficos conceptuales y porcentajes de cambio.`,

  recomendaciones: `Como consultor senior en construcción, proporciona recomendaciones para el proyecto HERGONSA:

SITUACIÓN ACTUAL:
{data}

Elabora:
1. RECOMENDACIONES INMEDIATAS (próximos 7 días)
   - Acciones específicas
   - Responsables sugeridos
   - Impacto esperado
2. RECOMENDACIONES A CORTO PLAZO (próximo mes)
3. MEJORAS DE PROCESO
   - Cambios en metodología
   - Optimización de recursos
4. GESTIÓN DE PERSONAL
   - Reasignaciones sugeridas
   - Capacitaciones necesarias
5. CONTROL DE COSTOS
   - Medidas de ahorro
   - Inversiones recomendadas
6. KPIs A MONITOREAR
7. PLAN DE ACCIÓN DETALLADO

Sé muy específico y práctico. Incluye métricas de éxito.`
};

// Constantes de configuración
const CONFIG_BIGQUERY = {
  // Tabla principal
  TABLA_REPORTES: process.env.BIGQUERY_TABLA_PRINCIPAL || '`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados`',
  
  // Límites para consultas
  LIMITE_TRABAJADORES: 20,
  LIMITE_ACTIVIDADES: 10,
  LIMITE_REGISTROS_GENERAL: 50,
  LIMITE_REGISTROS_PRODUCTIVIDAD: 100,
  
  // Rendimiento y optimización
  PARTITION_DAYS: 90, // Días para los que optimizar particiones
  MAX_BYTES_BILLED: '1000000000', // 1GB en bytes (límite de facturación)
  TIMEOUT_MS: 30000, // 30 segundos de timeout
  RETRY_COUNT: 3 // Número de reintentos
};

/**
 * Construye la cláusula común WHERE con optimizaciones para particionamiento
 */
function construirFiltroFechaOptimizado(fechaInicio: string, fechaFin: string): string {
  // Verificar si la diferencia en días es mayor que PARTITION_DAYS
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffTime = Math.abs(fin.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Si el rango es muy amplio, agregamos optimizaciones de partición por día
  if (diffDays > CONFIG_BIGQUERY.PARTITION_DAYS) {
    return `
      fecha BETWEEN @fechaInicio AND @fechaFin
      AND EXTRACT(YEAR FROM fecha) IN (
        ${Array.from(new Set([inicio.getFullYear(), fin.getFullYear()])).join(', ')}
      )
      AND EXTRACT(MONTH FROM fecha) BETWEEN ${inicio.getMonth() + 1} AND ${fin.getMonth() + 1}
    `;
  }
  
  // Para rangos pequeños, usamos la condición simple
  return `fecha BETWEEN @fechaInicio AND @fechaFin`;
}

/**
 * Funciones para las consultas SQL modularizadas con optimizaciones
 * - Uso de cláusulas PREWHERE para filtrado anticipado
 * - Optimización de columnas seleccionadas (solo las necesarias)
 * - Uso de filtros adicionales para optimizar la consulta
 * - Particionamiento inteligente según rango de fechas
 */
function obtenerQueryCostosGeneral(fechaInicio: string, fechaFin: string): string {
  const filtroFechaOptimizado = construirFiltroFechaOptimizado(fechaInicio, fechaFin);
  
  return `
    /* Optimización: Almacenar en temporales los datos filtrados por fecha */
    WITH datos_filtrados AS (
      SELECT
        trabajador_nombre,
        trabajador_categoria,
        actividad_proceso,
        actividad_und,
        horas_trabajadas,
        metrado_ejecutado,
        metrado_programado,
        productividad,
        costo_total,
        valor_metrado,
        ganancia
      FROM ${CONFIG_BIGQUERY.TABLA_REPORTES}
      WHERE ${filtroFechaOptimizado}
    ),
    
    /* Resumen de costos por categoría */
    costos_resumen AS (
      SELECT 
        trabajador_categoria,
        COUNT(DISTINCT trabajador_nombre) as num_trabajadores,
        SUM(horas_trabajadas) as total_horas,
        SUM(costo_total) as costo_total,
        SUM(metrado_ejecutado) as metrado_total,
        AVG(productividad) as productividad_promedio,
        SUM(ganancia) as ganancia_total
      FROM datos_filtrados
      GROUP BY trabajador_categoria
    ),
    
    /* Resumen de actividades más importantes */
    actividades_resumen AS (
      SELECT 
        actividad_proceso,
        actividad_und,
        SUM(metrado_ejecutado) as metrado_total,
        SUM(metrado_programado) as metrado_programado,
        SUM(horas_trabajadas) as horas_totales,
        SUM(costo_total) as costo_actividad,
        SUM(valor_metrado) as valor_total,
        SUM(ganancia) as ganancia_actividad,
        AVG(productividad) as productividad_promedio,
        COUNT(DISTINCT trabajador_nombre) as trabajadores_involucrados
      FROM datos_filtrados
      GROUP BY actividad_proceso, actividad_und
      ORDER BY valor_total DESC
      LIMIT ${CONFIG_BIGQUERY.LIMITE_ACTIVIDADES}
    ),
    
    /* Ranking de trabajadores más productivos */
    trabajadores_top AS (
      SELECT 
        trabajador_nombre,
        trabajador_categoria,
        SUM(horas_trabajadas) as total_horas,
        SUM(metrado_ejecutado) as metrado_total,
        AVG(productividad) as productividad_promedio,
        SUM(costo_total) as costo_trabajador,
        SUM(ganancia) as ganancia_generada
      FROM datos_filtrados
      GROUP BY trabajador_nombre, trabajador_categoria
      ORDER BY productividad_promedio DESC
      LIMIT ${CONFIG_BIGQUERY.LIMITE_TRABAJADORES}
    ),
    
    /* Resumen de totales para el período */
    totales AS (
      SELECT
        SUM(valor_metrado) as valor_total_periodo,
        SUM(costo_total) as costo_total_periodo,
        SUM(ganancia) as ganancia_total_periodo
      FROM datos_filtrados
    )
    
    /* Query final con todos los componentes */
    SELECT 
      (SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(*))) FROM costos_resumen) as costos_por_categoria,
      (SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(*))) FROM actividades_resumen) as top_actividades,
      (SELECT TO_JSON_STRING(ARRAY_AGG(STRUCT(*))) FROM trabajadores_top) as top_trabajadores,
      (SELECT valor_total_periodo FROM totales) as valor_total_periodo,
      (SELECT costo_total_periodo FROM totales) as costo_total_periodo,
      (SELECT ganancia_total_periodo FROM totales) as ganancia_total_periodo
  `;
}

function obtenerQueryProductividad(fechaInicio: string, fechaFin: string): string {
  const filtroFechaOptimizado = construirFiltroFechaOptimizado(fechaInicio, fechaFin);
  
  return `
    /* Optimización: Seleccionamos solo las columnas necesarias */
    SELECT 
      trabajador_nombre,
      trabajador_categoria,
      actividad_proceso,
      fecha,
      horas_trabajadas,
      metrado_ejecutado,
      metrado_programado,
      productividad,
      /* Clasificamos la productividad para análisis más sencillo */
      CASE 
        WHEN productividad > 1.2 THEN 'EXCELENTE'
        WHEN productividad > 0.8 THEN 'BUENO'
        WHEN productividad > 0.5 THEN 'REGULAR'
        ELSE 'BAJO'
      END as nivel_productividad,
      eficiencia_actividad,
      valor_metrado,
      costo_total,
      ganancia
    FROM ${CONFIG_BIGQUERY.TABLA_REPORTES}
    /* Filtrado optimizado por fecha */
    WHERE ${filtroFechaOptimizado}
    /* Filtramos primero los registros más relevantes */
    AND productividad IS NOT NULL
    ORDER BY fecha DESC, productividad DESC
    LIMIT ${CONFIG_BIGQUERY.LIMITE_REGISTROS_PRODUCTIVIDAD}
  `;
}

function obtenerQueryTendencias(fechaInicio: string, fechaFin: string): string {
  const filtroFechaOptimizado = construirFiltroFechaOptimizado(fechaInicio, fechaFin);
  
  return `
    /* Primera CTE para agrupar datos por día */
    WITH tendencias_diarias AS (
      SELECT 
        fecha,
        SUM(metrado_ejecutado) as metrado_dia,
        SUM(horas_trabajadas) as horas_dia,
        SUM(costo_total) as costo_dia,
        SUM(valor_metrado) as valor_dia,
        AVG(productividad) as productividad_dia,
        COUNT(DISTINCT trabajador_nombre) as trabajadores_dia
      FROM ${CONFIG_BIGQUERY.TABLA_REPORTES}
      WHERE ${filtroFechaOptimizado}
      GROUP BY fecha
      ORDER BY fecha
    )
    /* Consulta principal con métricas diarias y tendencias */
    SELECT 
      fecha,
      metrado_dia,
      horas_dia,
      costo_dia,
      valor_dia,
      productividad_dia,
      trabajadores_dia,
      /* Cálculos comparativos con el día anterior */
      LAG(metrado_dia) OVER (ORDER BY fecha) as metrado_dia_anterior,
      LAG(productividad_dia) OVER (ORDER BY fecha) as productividad_dia_anterior,
      /* Promedio móvil de 7 días para productividad */
      AVG(productividad_dia) OVER (ORDER BY fecha ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as productividad_promedio_7d,
      /* Indicadores de tendencia */
      CASE 
        WHEN productividad_dia > LAG(productividad_dia) OVER (ORDER BY fecha) THEN 'aumentando'
        WHEN productividad_dia < LAG(productividad_dia) OVER (ORDER BY fecha) THEN 'disminuyendo'
        ELSE 'estable'
      END as tendencia_productividad_diaria,
      CASE 
        WHEN costo_dia > LAG(costo_dia) OVER (ORDER BY fecha) THEN 'aumentando'
        WHEN costo_dia < LAG(costo_dia) OVER (ORDER BY fecha) THEN 'disminuyendo'
        ELSE 'estable'
      END as tendencia_costo_diario
    FROM tendencias_diarias
  `;
}

function obtenerQueryGeneral(fechaInicio: string, fechaFin: string): string {
  const filtroFechaOptimizado = construirFiltroFechaOptimizado(fechaInicio, fechaFin);
  
  return `
    /* Query optimizada para resumen general con agregaciones */
    SELECT 
      fecha,
      elaborado_por,
      COUNT(DISTINCT reporte_id) as num_reportes,
      COUNT(DISTINCT trabajador_nombre) as num_trabajadores,
      COUNT(DISTINCT actividad_proceso) as num_actividades,
      SUM(horas_trabajadas) as total_horas,
      SUM(metrado_ejecutado) as total_metrado_ejecutado,
      SUM(metrado_programado) as total_metrado_programado,
      SUM(valor_metrado) as total_valorizado,
      SUM(costo_total) as total_costo_mo,
      SUM(ganancia) as ganancia_total,
      /* Cálculo de indicadores clave */
      AVG(productividad) as productividad_promedio,
      SAFE_DIVIDE(SUM(valor_metrado), SUM(horas_trabajadas)) as valor_por_hora,
      SAFE_DIVIDE(SUM(ganancia), SUM(valor_metrado)) * 100 as margen_porcentaje
    FROM ${CONFIG_BIGQUERY.TABLA_REPORTES}
    WHERE ${filtroFechaOptimizado}
    GROUP BY fecha, elaborado_por
    ORDER BY fecha DESC
    LIMIT ${CONFIG_BIGQUERY.LIMITE_REGISTROS_GENERAL}
  `;
}

/**
 * Obtiene datos de BigQuery con optimizaciones y manejo de errores
 */
async function obtenerDatosBigQuery(fechaInicio: string, fechaFin: string, tipoAnalisis: TipoAnalisis) {
  try {
    let query = '';
    
    // Seleccionar la consulta apropiada según el tipo de análisis
    switch(tipoAnalisis) {
      case 'costos':
      case 'general':
        query = obtenerQueryCostosGeneral(fechaInicio, fechaFin);
        break;
      case 'productividad':
        query = obtenerQueryProductividad(fechaInicio, fechaFin);
        break;
      case 'tendencias':
        query = obtenerQueryTendencias(fechaInicio, fechaFin);
        break;
      case 'recomendaciones':
        // Para recomendaciones usamos la misma consulta que general
        query = obtenerQueryCostosGeneral(fechaInicio, fechaFin);
        break;
      default:
        query = obtenerQueryGeneral(fechaInicio, fechaFin);
    }

    // Configuración de opciones de consulta con límites
    const options = {
      query: query,
      params: {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin
      },
      // Configuración de seguridad y rendimiento
      maximumBytesBilled: CONFIG_BIGQUERY.MAX_BYTES_BILLED,
      timeoutMs: CONFIG_BIGQUERY.TIMEOUT_MS,
      jobTimeoutMs: CONFIG_BIGQUERY.TIMEOUT_MS * 2,
      // Minimizar uso de cache para datos frescos
      useQueryCache: false
    };

    console.log(`Ejecutando query BigQuery para análisis ${tipoAnalisis}...`);
    
    // Implementación de reintentos en caso de errores transitorios
    let intentos = 0;
    let ultimoError: unknown = null;
    
    while (intentos < CONFIG_BIGQUERY.RETRY_COUNT) {
      try {
        const [rows] = await bigquery.query(options);
        return rows;
      } catch (err: unknown) {
        ultimoError = err;
        
        // Verificar si el error es un objeto con propiedades código y mensaje
        const esErrorTransitorio = (errorObj: unknown): boolean => {
          if (typeof errorObj !== 'object' || errorObj === null) return false;
          
          const errorConCodigo = errorObj as { code?: string; message?: string };
          
          return (
            errorConCodigo.code === 'DEADLINE_EXCEEDED' || 
            errorConCodigo.code === 'RESOURCE_EXHAUSTED' ||
            (typeof errorConCodigo.message === 'string' && 
             errorConCodigo.message.includes('timeout'))
          );
        };
        
        // Solo reintentar para errores transitorios
        if (esErrorTransitorio(err)) {
          intentos++;
          console.log(`Reintento ${intentos}/${CONFIG_BIGQUERY.RETRY_COUNT} para consulta BigQuery...`);
          // Espera exponencial antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, intentos)));
        } else {
          // Error no recuperable, lanzar inmediatamente
          throw err;
        }
      }
    }
    
    // Si llegamos aquí es porque agotamos los reintentos
    throw ultimoError || new Error('Error desconocido en consulta BigQuery');
    
  } catch (error) {
    console.error('Error obteniendo datos de BigQuery:', error);
    throw error;
  }
}

// Función para formatear datos para el prompt
function formatearDatosParaIA(datos: any[], tipoAnalisis: TipoAnalisis): string {
  if (tipoAnalisis === 'costos' || tipoAnalisis === 'general') {
    // Para análisis de costos, parseamos los JSON strings
    const primerFila = datos[0];
    if (primerFila) {
      const costosPorCategoria = JSON.parse(primerFila.costos_por_categoria || '[]');
      const topActividades = JSON.parse(primerFila.top_actividades || '[]');
      const topTrabajadores = JSON.parse(primerFila.top_trabajadores || '[]');
      
      let formatted = `
RESUMEN FINANCIERO:
- Valor Total: S/ ${Number(primerFila.valor_total_periodo || 0).toLocaleString('es-PE')}
- Costo Total: S/ ${Number(primerFila.costo_total_periodo || 0).toLocaleString('es-PE')}
- Ganancia: S/ ${Number(primerFila.ganancia_total_periodo || 0).toLocaleString('es-PE')}
- Margen: ${((primerFila.ganancia_total_periodo / primerFila.valor_total_periodo) * 100).toFixed(2)}%

COSTOS POR CATEGORÍA:
${costosPorCategoria.map((c: any) => 
  `- ${c.trabajador_categoria}: ${c.num_trabajadores} trabajadores, ${c.total_horas.toFixed(1)} horas, S/ ${c.costo_total.toLocaleString('es-PE')}`
).join('\n')}

TOP 10 ACTIVIDADES:
${topActividades.map((a: any, i: number) => 
  `${i+1}. ${a.actividad_proceso} (${a.actividad_und})
   - Metrado: ${a.metrado_total.toFixed(2)}/${a.metrado_programado.toFixed(2)} (${((a.metrado_total/a.metrado_programado)*100).toFixed(1)}%)
   - Valor: S/ ${a.valor_total.toLocaleString('es-PE')}
   - Costo: S/ ${a.costo_actividad.toLocaleString('es-PE')}
   - Ganancia: S/ ${a.ganancia_actividad.toLocaleString('es-PE')}
   - Productividad: ${a.productividad_promedio.toFixed(2)}`
).join('\n')}

TOP 20 TRABAJADORES:
${topTrabajadores.map((t: any, i: number) => 
  `${i+1}. ${t.trabajador_nombre} (${t.trabajador_categoria})
   - Productividad: ${t.productividad_promedio.toFixed(2)}
   - Horas: ${t.total_horas.toFixed(1)}
   - Metrado: ${t.metrado_total.toFixed(2)}
   - Costo: S/ ${t.costo_trabajador.toLocaleString('es-PE')}`
).join('\n')}`;
      
      return formatted;
    }
  }
  
  // Para otros tipos de análisis
  return JSON.stringify(datos, null, 2);
}

/**
 * Procesa la respuesta de Gemini para extraer insights estructurados
 * Implementa múltiples estrategias de extracción para mayor robustez
 */
function procesarRespuestaGemini(texto: string, tipoAnalisis: TipoAnalisis): {
  insights: string[];
  recommendations: string[];
  productivityTrend: 'aumentando' | 'disminuyendo' | 'estable';
  costTrend: 'aumentando' | 'disminuyendo' | 'estable';
  keyActivities?: string[];
} {
  // Normalización del texto para análisis consistente
  const textoNormalizado = texto
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  const lineas = textoNormalizado.split('\n');
  const insights: string[] = [];
  const recommendations: string[] = [];
  const keyActivities: string[] = [];
  
  // Estado inicial de tendencias
  let productivityTrend: 'aumentando' | 'disminuyendo' | 'estable' = 'estable';
  let costTrend: 'aumentando' | 'disminuyendo' | 'estable' = 'estable';
  
  // Control de secciones en el texto
  let seccionActual = '';
  const seccionesReconocidas = {
    insights: ['HALLAZGO', 'PRINCIPAL', 'ANÁLISIS', 'RESUMEN EJECUTIVO'],
    recommendations: ['RECOMENDAC', 'SUGERENC', 'ACCION', 'PROPUESTA'],
    trends: ['TENDENC', 'EVOLUCIÓN', 'PROYECC', 'PREDICC'],
    activities: ['ACTIVIDAD', 'TAREA', 'PROCESOS']
  };
  
  // Patrones de detección mejorados
  const patronesTendencias = {
    productividadPositiva: [
      /productividad.{0,20}(aument|mejor|crec|positiv|subi)/i,
      /rendimiento.{0,20}(aument|mejor|crec|positiv|subi)/i,
      /eficiencia.{0,20}(aument|mejor|crec|positiv|subi)/i
    ],
    productividadNegativa: [
      /productividad.{0,20}(dismin|baj|decrec|reduc|cay|descend)/i,
      /rendimiento.{0,20}(dismin|baj|decrec|reduc|cay|descend)/i,
      /eficiencia.{0,20}(dismin|baj|decrec|reduc|cay|descend)/i
    ],
    costosPositivos: [
      /costo.{0,20}(dismin|baj|decrec|reduc|cay|descend|ahorro)/i,
      /gasto.{0,20}(dismin|baj|decrec|reduc|cay|descend|ahorro)/i,
      /inversión.{0,20}(dismin|baj|decrec|reduc|cay|descend|ahorro)/i
    ],
    costosNegativos: [
      /costo.{0,20}(aument|incre|subi|elev|mayor)/i,
      /gasto.{0,20}(aument|incre|subi|elev|mayor)/i,
      /inversión.{0,20}(aument|incre|subi|elev|mayor)/i
    ]
  };
  
  // Primero intentamos identificar secciones estructuradas
  for (const linea of lineas) {
    const lineaLimpia = linea.trim();
    
    // Detectar secciones por sus títulos o encabezados
    for (const [seccion, palabrasClave] of Object.entries(seccionesReconocidas)) {
      if (palabrasClave.some(palabra => lineaLimpia.toUpperCase().includes(palabra))) {
        seccionActual = seccion;
        break;
      }
    }
    
    // Extraer contenido según la sección actual
    // Patrón para identificar elementos de lista o párrafos numerados
    const esElementoLista = lineaLimpia.match(/^[\d\-\*\•\.\)]+\s*/);
    
    if (seccionActual === 'insights' && esElementoLista) {
      const insight = lineaLimpia.replace(/^[\d\-\*\•\.\)]+\s*/, '').trim();
      if (insight.length > 10) insights.push(insight);
    } else if (seccionActual === 'recommendations' && esElementoLista) {
      const rec = lineaLimpia.replace(/^[\d\-\*\•\.\)]+\s*/, '').trim();
      if (rec.length > 10) recommendations.push(rec);
    } else if (seccionActual === 'activities' && esElementoLista) {
      const activity = lineaLimpia.replace(/^[\d\-\*\•\.\)]+\s*/, '').trim();
      if (activity.length > 10) keyActivities.push(activity);
    }
    
    // Detección de tendencias con múltiples patrones
    patronesTendencias.productividadPositiva.forEach(patron => {
      if (patron.test(lineaLimpia)) productivityTrend = 'aumentando';
    });
    
    patronesTendencias.productividadNegativa.forEach(patron => {
      if (patron.test(lineaLimpia)) productivityTrend = 'disminuyendo';
    });
    
    patronesTendencias.costosPositivos.forEach(patron => {
      if (patron.test(lineaLimpia)) costTrend = 'disminuyendo'; // Costos que bajan son positivos
    });
    
    patronesTendencias.costosNegativos.forEach(patron => {
      if (patron.test(lineaLimpia)) costTrend = 'aumentando';
    });
  }
  
  // Si el análisis estructurado no produjo suficientes resultados, aplicamos extracción más general
  // Estrategia de respaldo #1: Búsqueda de frases completas significativas
  if (insights.length < 3) {
    // Buscar frases que comienzan con mayúscula y terminan con punto
    const posiblesInsights = textoNormalizado.match(/[A-Z][^.!?]*[.!?]/g) || [];
    const insightsFiltrados = posiblesInsights
      .map(s => s.trim())
      .filter(s => 
        s.length > 20 && 
        s.length < 200 && 
        !s.toLowerCase().includes('eres un') && 
        !s.toLowerCase().includes('analiza estos datos')
      );
    
    insights.push(...insightsFiltrados.slice(0, 5));
  }
  
  // Estrategia de respaldo #2: Extracción basada en palabras clave para recomendaciones
  if (recommendations.length < 3) {
    const patronesRecomendacion = [
      /(?:debe|debería|recomiend|suger|conviene)[^.!?]*[.!?]/gi,
      /(?:necesario|importante|vital|crucial|clave)[^.!?]*[.!?]/gi,
      /(?:implement|ejecut|realiz|desarroll|mejor)[^.!?]*[.!?]/gi
    ];
    
    let posiblesRecs: string[] = [];
    patronesRecomendacion.forEach(patron => {
      const encontrados = textoNormalizado.match(patron) || [];
      posiblesRecs.push(...encontrados);
    });
    
    recommendations.push(
      ...posiblesRecs
        .map(s => s.trim())
        .filter(s => s.length > 20 && s.length < 200)
        .slice(0, 5)
    );
  }
  
  // Estrategia de respaldo #3: Búsqueda contextual específica según tipo de análisis
  if (tipoAnalisis === 'costos' && insights.length < 5) {
    const patronesCostos = [
      /(?:costo|gasto|inversión|presupuesto|financ)[^.!?]*[.!?]/gi
    ];
    
    patronesCostos.forEach(patron => {
      const encontrados = textoNormalizado.match(patron) || [];
      insights.push(
        ...encontrados
          .map(s => s.trim())
          .filter(s => s.length > 20 && s.length < 200)
          .slice(0, 3)
      );
    });
  }
  
  if (tipoAnalisis === 'productividad' && insights.length < 5) {
    const patronesProductividad = [
      /(?:productiv|rendimiento|eficiencia|desempeño)[^.!?]*[.!?]/gi
    ];
    
    patronesProductividad.forEach(patron => {
      const encontrados = textoNormalizado.match(patron) || [];
      insights.push(
        ...encontrados
          .map(s => s.trim())
          .filter(s => s.length > 20 && s.length < 200)
          .slice(0, 3)
      );
    });
  }
  
  // Eliminar duplicados
  const uniqueInsights = [...new Set(insights)];
  const uniqueRecommendations = [...new Set(recommendations)];
  const uniqueActivities = [...new Set(keyActivities)];
  
  return {
    insights: uniqueInsights.slice(0, 10),
    recommendations: uniqueRecommendations.slice(0, 10),
    productivityTrend,
    costTrend,
    keyActivities: uniqueActivities.length > 0 ? uniqueActivities.slice(0, 5) : undefined
  };
}

/**
 * Verifica si todas las variables de entorno requeridas están definidas
 */
function verificarVariablesEntorno(): { valido: boolean; faltantes: string[] } {
  const variablesRequeridas = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL', 
    'FIREBASE_PRIVATE_KEY',
    'BIGQUERY_PROJECT_ID',
    'GEMINI_API_KEY'
  ];
  
  const faltantes = variablesRequeridas.filter(variable => !process.env[variable]);
  
  return {
    valido: faltantes.length === 0,
    faltantes
  };
}

/**
 * Valida los parámetros de entrada de la solicitud
 */
function validarParametrosEntrada(body: any): { valido: boolean; error?: string } {
  // Verificar que el cuerpo existe
  if (!body) {
    return { valido: false, error: 'No se proporcionaron datos de entrada' };
  }

  // Verificar que filters existe
  if (!body.filters) {
    return { valido: false, error: 'Se requiere el objeto filters en la solicitud' };
  }

  // Verificar fechas
  const { inicio, fin } = body.filters;
  if (!inicio || !fin) {
    return { valido: false, error: 'Se requieren fechas de inicio y fin en el objeto filters' };
  }

  // Validar formato de fechas
  const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
  if (!regexFecha.test(inicio) || !regexFecha.test(fin)) {
    return { valido: false, error: 'Las fechas deben tener formato YYYY-MM-DD' };
  }

  // Validar que fecha inicio <= fecha fin
  if (new Date(inicio) > new Date(fin)) {
    return { valido: false, error: 'La fecha de inicio debe ser anterior o igual a la fecha de fin' };
  }

  // Validar tipo de análisis
  const tipoAnalisis = body.tipoAnalisis || 'general';
  const tiposValidos = ['general', 'costos', 'productividad', 'tendencias', 'recomendaciones', 'personalizado'];
  
  if (!tiposValidos.includes(tipoAnalisis)) {
    return { valido: false, error: `Tipo de análisis '${tipoAnalisis}' no válido. Opciones: ${tiposValidos.join(', ')}` };
  }

  // Si es personalizado, debe incluir el promptPersonalizado
  if (tipoAnalisis === 'personalizado' && !body.promptPersonalizado) {
    return { valido: false, error: 'Para análisis personalizado se requiere el campo promptPersonalizado' };
  }

  return { valido: true };
}

/**
 * Maneja los errores de forma específica según su tipo
 */
function manejarError(error: unknown): { mensaje: string; codigo: number; detalles?: any } {
  console.error('Error en análisis IA:', error);
  
  // Convertir a Error si no lo es
  const err = error instanceof Error ? error : new Error(String(error));
  
  // Categorizar errores para dar respuestas más específicas
  if (err.message.includes('API key')) {
    return { 
      mensaje: 'Error de configuración: API key de Gemini no válida',
      codigo: 500,
      detalles: 'Verifique la variable de entorno GEMINI_API_KEY'
    };
  } 
  else if (err.message.includes('permission') || err.message.includes('credential')) {
    return { 
      mensaje: 'Error de autenticación con BigQuery',
      codigo: 401,
      detalles: 'Verifique las credenciales de BigQuery'
    };
  }
  else if (err.message.includes('BigQuery')) {
    return { 
      mensaje: 'Error en la consulta a BigQuery',
      codigo: 502,
      detalles: err.message
    };
  }
  else if (err.message.includes('DEADLINE_EXCEEDED')) {
    return { 
      mensaje: 'Tiempo de espera agotado para la consulta',
      codigo: 504,
      detalles: 'La consulta tomó demasiado tiempo en ejecutarse'
    };
  }
  
  // Error genérico
  return { 
    mensaje: `Error procesando análisis: ${err.message}`,
    codigo: 500
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar variables de entorno
    const estadoVariables = verificarVariablesEntorno();
    if (!estadoVariables.valido) {
      console.error(`Variables de entorno faltantes: ${estadoVariables.faltantes.join(', ')}`);
      return NextResponse.json(
        { 
          error: 'Error de configuración del servidor', 
          details: `Variables de entorno faltantes: ${estadoVariables.faltantes.join(', ')}`
        },
        { status: 500 }
      );
    }
    
    // 2. Validar el cuerpo de la solicitud
    const body = await request.json() as AnalysisRequest;
    const validacion = validarParametrosEntrada(body);
    
    if (!validacion.valido) {
      return NextResponse.json(
        { error: validacion.error },
        { status: 400 }
      );
    }
    
    const { filters, tipoAnalisis = 'general' as TipoAnalisis, promptPersonalizado } = body;
    console.log(`Procesando análisis IA: ${tipoAnalisis} para período ${filters.inicio} - ${filters.fin}`);
    
    // 3. Obtener datos de BigQuery con manejo de errores específico
    let datosBigQuery;
    try {
      datosBigQuery = await obtenerDatosBigQuery(filters.inicio, filters.fin, tipoAnalisis);
      
      if (!datosBigQuery || datosBigQuery.length === 0) {
        return NextResponse.json(
          { error: 'No se encontraron datos para el período especificado' },
          { status: 404 }
        );
      }
    } catch (errorBQ) {
      const errorManejado = manejarError(errorBQ);
      return NextResponse.json(
        { error: errorManejado.mensaje, details: errorManejado.detalles },
        { status: errorManejado.codigo }
      );
    }
    
    // 4. Formatear datos para el prompt
    const datosFormateados = formatearDatosParaIA(datosBigQuery, tipoAnalisis);
    
    // 5. Preparar el prompt con manejo seguro para tipos
    let promptFinal = promptPersonalizado || 
      (tipoAnalisis !== 'personalizado' ? PROMPTS_CONSTRUCCION[tipoAnalisis] : null) || 
      PROMPTS_CONSTRUCCION.general;
    
    // 6. Reemplazar placeholders en el prompt con validación
    promptFinal = promptFinal.replace('{data}', datosFormateados || 'No hay datos disponibles');
    
    // 7. Si es análisis de costos, agregar datos específicos con manejo de errores
    if (tipoAnalisis === 'costos' && datosBigQuery[0]) {
      try {
        const costosPorCategoria = JSON.parse(datosBigQuery[0].costos_por_categoria || '[]');
        const costoOperario = costosPorCategoria.find((c: CostoCategoria) => c.trabajador_categoria === 'OPERARIO')?.costo_total || 0;
        const costoOficial = costosPorCategoria.find((c: CostoCategoria) => c.trabajador_categoria === 'OFICIAL')?.costo_total || 0;
        const costoPeon = costosPorCategoria.find((c: CostoCategoria) => c.trabajador_categoria === 'PEON')?.costo_total || 0;
        
        promptFinal = promptFinal.replace('{costoOperario}', costoOperario.toLocaleString('es-PE'));
        promptFinal = promptFinal.replace('{costoOficial}', costoOficial.toLocaleString('es-PE'));
        promptFinal = promptFinal.replace('{costoPeon}', costoPeon.toLocaleString('es-PE'));
      } catch (errorJSON) {
        console.error('Error procesando datos de costos por categoría:', errorJSON);
        // Continuar con valores por defecto si hay error en el parsing
        promptFinal = promptFinal
          .replace('{costoOperario}', '0')
          .replace('{costoOficial}', '0')
          .replace('{costoPeon}', '0');
      }
    }
    
    // 8. Llamar a Gemini con manejo de tiempos de espera
    console.log('Enviando prompt a Gemini...');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.4,
      }
    });
    
    // 9. Capturar y manejar específicamente errores de Gemini
    let text;
    try {
      const result = await model.generateContent(promptFinal);
      const response = await result.response;
      text = response.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('La respuesta de Gemini está vacía');
      }
    } catch (errorGemini) {
      const errorManejado = manejarError(errorGemini);
      return NextResponse.json(
        { error: errorManejado.mensaje, details: errorManejado.detalles },
        { status: errorManejado.codigo }
      );
    }
    
    console.log('Respuesta de Gemini recibida, procesando...');
    
    // 10. Procesar la respuesta con manejo de errores
    let analisisProcesado;
    try {
      analisisProcesado = procesarRespuestaGemini(text, tipoAnalisis);
    } catch (errorProcesamiento) {
      console.error('Error procesando respuesta de Gemini:', errorProcesamiento);
      // Si falla el procesamiento, crear una estructura mínima para devolver el texto
      analisisProcesado = {
        insights: [],
        recommendations: [],
        productivityTrend: 'estable' as const,
        costTrend: 'estable' as const
      };
    }
    
    // 11. Preparar respuesta final con toda la información disponible
    const respuestaFinal: AnalisisRespuesta = {
      text: text,
      insights: {
        mainPoints: analisisProcesado.insights,
        recommendations: analisisProcesado.recommendations,
        productivityTrend: analisisProcesado.productivityTrend,
        costTrend: analisisProcesado.costTrend,
        keyActivities: analisisProcesado.keyActivities || []
      },
      dataTimestamp: new Date().toISOString(),
      queryType: tipoAnalisis,
      metadata: {
        periodo: `${filters.inicio} a ${filters.fin}`,
        registrosAnalizados: datosBigQuery.length,
        fuenteDatos: 'BigQuery - hergonsa_analytics'
      }
    };
    
    console.log(`Análisis IA completado exitosamente para ${tipoAnalisis}`);
    
    return NextResponse.json(respuestaFinal);
    
  } catch (error: unknown) {
    // 12. Manejo centralizado de errores no capturados
    const errorManejado = manejarError(error);
    return NextResponse.json(
      { error: errorManejado.mensaje, details: errorManejado.detalles },
      { status: errorManejado.codigo }
    );
  }
}