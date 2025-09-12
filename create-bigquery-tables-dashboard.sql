-- ============================================================================
-- SCRIPT PARA CREAR TABLAS DE BIGQUERY PARA EL DASHBOARD HERGONSA
-- Dataset: hergonsa_analytics
-- ============================================================================

-- 1. TABLA DE REPORTES DETALLADOS
-- Contiene cada registro de trabajador por actividad por día
CREATE TABLE IF NOT EXISTS `pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados` (
  reporte_id STRING NOT NULL,
  fecha DATE NOT NULL,
  elaborado_por STRING,
  subcontratista_bloque STRING,
  revisado_por STRING,
  
  -- Datos de actividad
  actividad_numero INT64,
  actividad_proceso STRING,
  actividad_ubicacion STRING,
  actividad_und STRING,
  metrado_programado FLOAT64,
  metrado_ejecutado FLOAT64,
  precio_unitario FLOAT64,
  valor_metrado FLOAT64,
  porcentaje_avance FLOAT64,
  causas_no_cumplimiento STRING,
  comentarios_actividad STRING,
  
  -- Datos de trabajador
  trabajador_nombre STRING,
  trabajador_categoria STRING,
  trabajador_especificacion STRING,
  horas_trabajadas FLOAT64,
  costo_hora FLOAT64,
  costo_total FLOAT64,
  productividad FLOAT64,
  observacion_trabajador STRING,
  
  -- Cálculos adicionales
  eficiencia_actividad FLOAT64,
  ganancia FLOAT64,
  
  -- Metadatos
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY fecha
CLUSTER BY reporte_id, trabajador_categoria;

-- 2. TABLA DE RESUMEN DIARIO
-- Contiene métricas agregadas por día
CREATE TABLE IF NOT EXISTS `pruebas-9e15f.hergonsa_analytics.hergonsa_resumen_diario` (
  fecha DATE NOT NULL,
  reporte_id STRING NOT NULL,
  elaborado_por STRING,
  subcontratista_bloque STRING,
  total_valorizado FLOAT64,
  total_costo_mo FLOAT64,
  ganancia_total FLOAT64,
  margen_ganancia FLOAT64,
  eficiencia_general FLOAT64,
  productividad_promedio FLOAT64,
  total_actividades INT64,
  total_trabajadores INT64,
  total_horas FLOAT64,
  total_metrado_programado FLOAT64,
  total_metrado_ejecutado FLOAT64,
  semana_iso STRING,
  mes STRING,
  anio INT64,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY fecha
CLUSTER BY mes, semana_iso;

-- 3. VISTA PARA MÉTRICAS SEMANALES
CREATE OR REPLACE VIEW `pruebas-9e15f.hergonsa_analytics.metricas_semanales` AS
SELECT 
  semana_iso,
  anio,
  COUNT(DISTINCT fecha) as dias_trabajados,
  COUNT(DISTINCT reporte_id) as total_reportes,
  SUM(total_valorizado) as total_valorizado_semanal,
  SUM(total_costo_mo) as total_costo_mo_semanal,
  SUM(ganancia_total) as ganancia_total_semanal,
  AVG(margen_ganancia) as margen_promedio_semanal,
  AVG(eficiencia_general) as eficiencia_promedio_semanal,
  AVG(productividad_promedio) as productividad_promedio_semanal,
  SUM(total_actividades) as total_actividades_semanal,
  MAX(total_trabajadores) as max_trabajadores_semanal,
  SUM(total_horas) as total_horas_semanal,
  SUM(total_metrado_ejecutado) as total_metrado_ejecutado_semanal
FROM `pruebas-9e15f.hergonsa_analytics.hergonsa_resumen_diario`
GROUP BY semana_iso, anio
ORDER BY anio DESC, semana_iso DESC;

-- 4. VISTA PARA MÉTRICAS MENSUALES
CREATE OR REPLACE VIEW `pruebas-9e15f.hergonsa_analytics.metricas_mensuales` AS
SELECT 
  mes,
  anio,
  COUNT(DISTINCT fecha) as dias_trabajados,
  COUNT(DISTINCT reporte_id) as total_reportes,
  SUM(total_valorizado) as total_valorizado_mensual,
  SUM(total_costo_mo) as total_costo_mo_mensual,
  SUM(ganancia_total) as ganancia_total_mensual,
  AVG(margen_ganancia) as margen_promedio_mensual,
  AVG(eficiencia_general) as eficiencia_promedio_mensual,
  AVG(productividad_promedio) as productividad_promedio_mensual,
  SUM(total_actividades) as total_actividades_mensual,
  MAX(total_trabajadores) as max_trabajadores_mensual,
  SUM(total_horas) as total_horas_mensual,
  SUM(total_metrado_ejecutado) as total_metrado_ejecutado_mensual
FROM `pruebas-9e15f.hergonsa_analytics.hergonsa_resumen_diario`
GROUP BY mes, anio
ORDER BY anio DESC, mes DESC;

-- 5. VISTA PARA ANÁLISIS POR TRABAJADOR
CREATE OR REPLACE VIEW `pruebas-9e15f.hergonsa_analytics.analisis_trabajadores` AS
SELECT 
  trabajador_nombre,
  trabajador_categoria,
  COUNT(DISTINCT fecha) as dias_trabajados,
  COUNT(DISTINCT reporte_id) as reportes_participados,
  SUM(horas_trabajadas) as total_horas,
  SUM(costo_total) as total_costo,
  AVG(productividad) as productividad_promedio,
  SUM(CASE WHEN trabajador_categoria = 'OPERARIO' THEN horas_trabajadas ELSE 0 END) as horas_operario,
  SUM(CASE WHEN trabajador_categoria = 'OFICIAL' THEN horas_trabajadas ELSE 0 END) as horas_oficial,
  SUM(CASE WHEN trabajador_categoria = 'PEON' THEN horas_trabajadas ELSE 0 END) as horas_peon
FROM `pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados`
GROUP BY trabajador_nombre, trabajador_categoria
ORDER BY total_horas DESC;

-- 6. VISTA PARA ANÁLISIS POR ACTIVIDAD
CREATE OR REPLACE VIEW `pruebas-9e15f.hergonsa_analytics.analisis_actividades` AS
SELECT 
  actividad_proceso,
  actividad_und,
  COUNT(DISTINCT fecha) as dias_ejecutados,
  COUNT(DISTINCT reporte_id) as reportes_relacionados,
  SUM(metrado_ejecutado) as total_metrado_ejecutado,
  SUM(valor_metrado) as total_valor_metrado,
  SUM(costo_total) as total_costo_mo,
  SUM(ganancia) as total_ganancia,
  AVG(porcentaje_avance) as porcentaje_avance_promedio,
  AVG(productividad) as productividad_promedio,
  SUM(horas_trabajadas) as total_horas_invertidas,
  COUNT(DISTINCT trabajador_nombre) as trabajadores_involucrados
FROM `pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados`
GROUP BY actividad_proceso, actividad_und
ORDER BY total_valor_metrado DESC;

-- ============================================================================
-- ÍNDICES Y OPTIMIZACIONES
-- ============================================================================

-- Las tablas ya tienen particionado y clustering configurado para optimizar consultas
-- por fecha, reporte_id y categorías de trabajador.

-- ============================================================================
-- PERMISOS (Ejecutar si es necesario)
-- ============================================================================

-- GRANT `roles/bigquery.dataViewer` ON TABLE `pruebas-9e15f.hergonsa_analytics.hergonsa_reportes_detallados` TO "serviceAccount:firebase-adminsdk-xxxxx@pruebas-9e15f.iam.gserviceaccount.com";
-- GRANT `roles/bigquery.dataViewer` ON TABLE `pruebas-9e15f.hergonsa_analytics.hergonsa_resumen_diario` TO "serviceAccount:firebase-adminsdk-xxxxx@pruebas-9e15f.iam.gserviceaccount.com";
