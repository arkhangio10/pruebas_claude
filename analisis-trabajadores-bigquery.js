/**
 * CONSULTAS DE ANÁLISIS PARA TRABAJADORES - BIGQUERY
 * 
 * Consultas SQL optimizadas para análisis avanzado de productividad y costos
 * usando las tablas de BigQuery que alimenta el dashboard-etl-generator.js
 */

const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery({
  projectId: 'pruebas-9e15f',
  keyFilename: './credenciales.json'
});

/**
 * 🏆 RANKING DE PRODUCTIVIDAD DE TODOS LOS TRABAJADORES
 */
async function obtenerRankingProductividad(fechaInicio = null, fechaFin = null) {
  try {
    let whereClause = '';
    if (fechaInicio && fechaFin) {
      whereClause = `WHERE fecha BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    }
    
    const query = `
      SELECT 
        trabajador_nombre,
        trabajador_categoria,
        COUNT(DISTINCT fecha) as dias_trabajados,
        COUNT(DISTINCT reporte_id) as reportes_participados,
        SUM(horas_trabajadas) as total_horas,
        SUM(costo_total) as total_costo,
        SUM(metrado_ejecutado) as total_metrado,
        AVG(productividad) as productividad_promedio,
        SUM(metrado_ejecutado) / SUM(horas_trabajadas) as productividad_global,
        SUM(costo_total) / SUM(horas_trabajadas) as costo_por_hora,
        SUM(metrado_ejecutado) / SUM(costo_total) as metrado_por_sol,
        AVG(eficiencia_actividad) as eficiencia_promedio,
        SUM(ganancia) as ganancia_total,
        
        -- Análisis por actividades más frecuentes
        ARRAY_AGG(DISTINCT actividad_proceso IGNORE NULLS LIMIT 5) as actividades_principales,
        
        -- Productividad por categoría comparativa
        CASE 
          WHEN trabajador_categoria = 'OPERARIO' THEN 
            (SUM(metrado_ejecutado) / SUM(horas_trabajadas)) / 
            (SELECT AVG(metrado_ejecutado / horas_trabajadas) 
             FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\` 
             WHERE trabajador_categoria = 'OPERARIO' AND horas_trabajadas > 0)
          WHEN trabajador_categoria = 'OFICIAL' THEN 
            (SUM(metrado_ejecutado) / SUM(horas_trabajadas)) / 
            (SELECT AVG(metrado_ejecutado / horas_trabajadas) 
             FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\` 
             WHERE trabajador_categoria = 'OFICIAL' AND horas_trabajadas > 0)
          WHEN trabajador_categoria = 'PEON' THEN 
            (SUM(metrado_ejecutado) / SUM(horas_trabajadas)) / 
            (SELECT AVG(metrado_ejecutado / horas_trabajadas) 
             FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\` 
             WHERE trabajador_categoria = 'PEON' AND horas_trabajadas > 0)
          ELSE 1
        END as ratio_productividad_categoria
        
      FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
      ${whereClause}
      GROUP BY trabajador_nombre, trabajador_categoria
      HAVING total_horas > 0
      ORDER BY productividad_global DESC, total_metrado DESC
    `;
    
    console.log('🏆 Ejecutando consulta de ranking de productividad...');
    const [rows] = await bigquery.query(query);
    
    // Agregar posiciones en el ranking
    const resultados = rows.map((row, index) => ({
      ...row,
      ranking_posicion: index + 1,
      es_top_10: index < 10,
      nivel_productividad: 
        index < rows.length * 0.2 ? 'EXCELENTE' :
        index < rows.length * 0.5 ? 'BUENO' :
        index < rows.length * 0.8 ? 'REGULAR' : 'BAJO'
    }));
    
    console.log(`✅ Ranking completado para ${resultados.length} trabajadores`);
    
    return {
      fecha_analisis: new Date().toISOString(),
      periodo: { inicio: fechaInicio, fin: fechaFin },
      total_trabajadores: resultados.length,
      trabajadores: resultados,
      estadisticas: {
        productividad_maxima: resultados[0]?.productividad_global || 0,
        productividad_promedio: resultados.reduce((sum, t) => sum + t.productividad_global, 0) / resultados.length,
        costo_total: resultados.reduce((sum, t) => sum + t.total_costo, 0),
        metrado_total: resultados.reduce((sum, t) => sum + t.total_metrado, 0)
      }
    };
    
  } catch (error) {
    console.error('❌ Error en ranking de productividad:', error);
    throw error;
  }
}

/**
 * 💰 ANÁLISIS DETALLADO DE COSTOS POR TRABAJADOR
 */
async function obtenerAnalisisCostosDetallado(periodo = 'mensual') {
  try {
    const query = `
      WITH costos_trabajador AS (
        SELECT 
          trabajador_nombre,
          trabajador_categoria,
          FORMAT_DATE('%Y-%m', fecha) as periodo_mes,
          FORMAT_DATE('%Y-W%V', fecha) as periodo_semana,
          
          -- Métricas básicas
          SUM(horas_trabajadas) as horas_periodo,
          SUM(costo_total) as costo_periodo,
          SUM(metrado_ejecutado) as metrado_periodo,
          
          -- Costos por hora y productividad
          AVG(costo_hora) as costo_hora_promedio,
          SUM(metrado_ejecutado) / SUM(horas_trabajadas) as productividad_periodo,
          SUM(metrado_ejecutado) / SUM(costo_total) as eficiencia_costo,
          
          -- Análisis de ganancia
          SUM(ganancia) as ganancia_periodo,
          SUM(ganancia) / SUM(costo_total) as roi_mano_obra,
          
          -- Diversidad de actividades
          COUNT(DISTINCT actividad_proceso) as actividades_diferentes,
          COUNT(DISTINCT fecha) as dias_trabajados
          
        FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
        WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY 
          trabajador_nombre, 
          trabajador_categoria,
          ${periodo === 'mensual' ? 'periodo_mes' : 'periodo_semana'}
      ),
      
      tendencias AS (
        SELECT 
          trabajador_nombre,
          trabajador_categoria,
          
          -- Tendencias de costo
          CORR(PARSE_DATE('%Y-%m', periodo_mes), costo_periodo) as tendencia_costo,
          CORR(PARSE_DATE('%Y-%m', periodo_mes), productividad_periodo) as tendencia_productividad,
          
          -- Estadísticas agregadas
          SUM(costo_periodo) as costo_total,
          SUM(metrado_periodo) as metrado_total,
          AVG(productividad_periodo) as productividad_promedio,
          AVG(eficiencia_costo) as eficiencia_promedio,
          
          -- Variabilidad
          STDDEV(costo_periodo) as variabilidad_costo,
          STDDEV(productividad_periodo) as variabilidad_productividad,
          
          -- Período más productivo
          MAX(productividad_periodo) as mejor_productividad,
          MIN(productividad_periodo) as peor_productividad
          
        FROM costos_trabajador
        GROUP BY trabajador_nombre, trabajador_categoria
      )
      
      SELECT 
        t.*,
        
        -- Clasificación de tendencias
        CASE 
          WHEN tendencia_costo > 0.5 THEN 'COSTO_CRECIENTE'
          WHEN tendencia_costo < -0.5 THEN 'COSTO_DECRECIENTE'
          ELSE 'COSTO_ESTABLE'
        END as clasificacion_costo,
        
        CASE 
          WHEN tendencia_productividad > 0.5 THEN 'PRODUCTIVIDAD_MEJORANDO'
          WHEN tendencia_productividad < -0.5 THEN 'PRODUCTIVIDAD_EMPEORANDO'
          ELSE 'PRODUCTIVIDAD_ESTABLE'
        END as clasificacion_productividad,
        
        -- Ranking por categoría
        ROW_NUMBER() OVER (
          PARTITION BY trabajador_categoria 
          ORDER BY eficiencia_promedio DESC
        ) as ranking_categoria
        
      FROM tendencias t
      ORDER BY eficiencia_promedio DESC, costo_total DESC
    `;
    
    console.log('💰 Ejecutando análisis detallado de costos...');
    const [rows] = await bigquery.query(query);
    
    return {
      fecha_analisis: new Date().toISOString(),
      periodo,
      total_trabajadores: rows.length,
      trabajadores: rows,
      resumen_por_categoria: await obtenerResumenPorCategoria()
    };
    
  } catch (error) {
    console.error('❌ Error en análisis de costos:', error);
    throw error;
  }
}

/**
 * 📊 COMPARATIVO DE PRODUCTIVIDAD POR ACTIVIDAD
 */
async function obtenerProductividadPorActividad() {
  try {
    const query = `
      SELECT 
        actividad_proceso,
        actividad_und,
        
        -- Análisis por trabajador
        trabajador_nombre,
        trabajador_categoria,
        
        -- Métricas de productividad específicas por actividad
        SUM(metrado_ejecutado) as metrado_total_actividad,
        SUM(horas_trabajadas) as horas_total_actividad,
        SUM(metrado_ejecutado) / SUM(horas_trabajadas) as productividad_trabajador_actividad,
        
        -- Comparación con promedio de la actividad
        (SUM(metrado_ejecutado) / SUM(horas_trabajadas)) / 
        AVG(SUM(metrado_ejecutado) / SUM(horas_trabajadas)) OVER (PARTITION BY actividad_proceso) as ratio_vs_promedio,
        
        -- Especialización del trabajador
        COUNT(DISTINCT fecha) as dias_en_actividad,
        SUM(horas_trabajadas) / SUM(SUM(horas_trabajadas)) OVER (PARTITION BY trabajador_nombre) as porcentaje_tiempo_actividad,
        
        -- Calidad del trabajo (basado en eficiencia)
        AVG(eficiencia_actividad) as eficiencia_promedio,
        
        -- Costo-beneficio
        SUM(ganancia) / SUM(costo_total) as roi_actividad
        
      FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
      WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
      GROUP BY 
        actividad_proceso, 
        actividad_und, 
        trabajador_nombre, 
        trabajador_categoria
      HAVING 
        horas_total_actividad >= 8  -- Mínimo 1 día de trabajo
      ORDER BY 
        actividad_proceso, 
        productividad_trabajador_actividad DESC
    `;
    
    console.log('📊 Analizando productividad por actividad...');
    const [rows] = await bigquery.query(query);
    
    // Agrupar por actividad
    const actividadesMap = new Map();
    
    rows.forEach(row => {
      const actividadKey = row.actividad_proceso;
      
      if (!actividadesMap.has(actividadKey)) {
        actividadesMap.set(actividadKey, {
          actividad: row.actividad_proceso,
          unidad: row.actividad_und,
          trabajadores: [],
          estadisticas: {
            productividad_maxima: 0,
            productividad_minima: Infinity,
            productividad_promedio: 0
          }
        });
      }
      
      const actividad = actividadesMap.get(actividadKey);
      actividad.trabajadores.push(row);
      
      // Actualizar estadísticas
      actividad.estadisticas.productividad_maxima = Math.max(
        actividad.estadisticas.productividad_maxima, 
        row.productividad_trabajador_actividad
      );
      actividad.estadisticas.productividad_minima = Math.min(
        actividad.estadisticas.productividad_minima,
        row.productividad_trabajador_actividad
      );
    });
    
    // Calcular promedios
    actividadesMap.forEach(actividad => {
      const productividades = actividad.trabajadores.map(t => t.productividad_trabajador_actividad);
      actividad.estadisticas.productividad_promedio = 
        productividades.reduce((sum, p) => sum + p, 0) / productividades.length;
    });
    
    return Array.from(actividadesMap.values());
    
  } catch (error) {
    console.error('❌ Error en productividad por actividad:', error);
    throw error;
  }
}

/**
 * 📈 EVOLUCIÓN TEMPORAL DE PRODUCTIVIDAD
 */
async function obtenerEvolucionProductividad(trabajadorNombre = null, meses = 12) {
  try {
    let whereClause = `WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL ${meses} MONTH)`;
    if (trabajadorNombre) {
      whereClause += ` AND trabajador_nombre = '${trabajadorNombre}'`;
    }
    
    const query = `
      WITH evolucion_mensual AS (
        SELECT 
          ${trabajadorNombre ? `trabajador_nombre,` : ''}
          trabajador_categoria,
          FORMAT_DATE('%Y-%m', fecha) as mes,
          
          SUM(metrado_ejecutado) as metrado_mes,
          SUM(horas_trabajadas) as horas_mes,
          SUM(costo_total) as costo_mes,
          SUM(metrado_ejecutado) / SUM(horas_trabajadas) as productividad_mes,
          AVG(eficiencia_actividad) as eficiencia_mes,
          COUNT(DISTINCT actividad_proceso) as actividades_diversidad,
          COUNT(DISTINCT fecha) as dias_trabajados_mes
          
        FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
        ${whereClause}
        GROUP BY 
          ${trabajadorNombre ? `trabajador_nombre,` : ''}
          trabajador_categoria,
          mes
        ORDER BY mes
      )
      
      SELECT 
        *,
        
        -- Tendencias (comparación con mes anterior)
        LAG(productividad_mes, 1) OVER (
          ${trabajadorNombre ? 'PARTITION BY trabajador_nombre ' : ''}
          ORDER BY mes
        ) as productividad_mes_anterior,
        
        productividad_mes - LAG(productividad_mes, 1) OVER (
          ${trabajadorNombre ? 'PARTITION BY trabajador_nombre ' : ''}
          ORDER BY mes
        ) as cambio_productividad,
        
        -- Promedios móviles
        AVG(productividad_mes) OVER (
          ${trabajadorNombre ? 'PARTITION BY trabajador_nombre ' : ''}
          ORDER BY mes 
          ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) as productividad_promedio_3m
        
      FROM evolucion_mensual
    `;
    
    console.log(`📈 Analizando evolución temporal (${meses} meses)...`);
    const [rows] = await bigquery.query(query);
    
    return {
      trabajador: trabajadorNombre || 'TODOS',
      periodo_meses: meses,
      fecha_analisis: new Date().toISOString(),
      evolucion: rows,
      tendencias: calcularTendenciasGenerales(rows)
    };
    
  } catch (error) {
    console.error('❌ Error en evolución temporal:', error);
    throw error;
  }
}

// FUNCIONES AUXILIARES

async function obtenerResumenPorCategoria() {
  const query = `
    SELECT 
      trabajador_categoria,
      COUNT(DISTINCT trabajador_nombre) as cantidad_trabajadores,
      SUM(costo_total) as costo_total_categoria,
      SUM(metrado_ejecutado) as metrado_total_categoria,
      AVG(productividad) as productividad_promedio_categoria,
      SUM(metrado_ejecutado) / SUM(costo_total) as eficiencia_categoria
    FROM \`pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados\`
    WHERE fecha >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
    GROUP BY trabajador_categoria
    ORDER BY eficiencia_categoria DESC
  `;
  
  const [rows] = await bigquery.query(query);
  return rows;
}

function calcularTendenciasGenerales(evolucion) {
  if (evolucion.length < 3) return { tendencia: 'INSUFICIENTES_DATOS' };
  
  const primera = evolucion[0];
  const ultima = evolucion[evolucion.length - 1];
  const cambioTotal = ultima.productividad_mes - primera.productividad_mes;
  const porcentajeCambio = (cambioTotal / primera.productividad_mes) * 100;
  
  return {
    tendencia: porcentajeCambio > 10 ? 'MEJORANDO' : 
               porcentajeCambio < -10 ? 'EMPEORANDO' : 'ESTABLE',
    cambio_porcentual: porcentajeCambio,
    mejor_mes: evolucion.reduce((max, current) => 
      current.productividad_mes > max.productividad_mes ? current : max
    ),
    peor_mes: evolucion.reduce((min, current) => 
      current.productividad_mes < min.productividad_mes ? current : min
    )
  };
}

module.exports = {
  obtenerRankingProductividad,
  obtenerAnalisisCostosDetallado,
  obtenerProductividadPorActividad,
  obtenerEvolucionProductividad
};
