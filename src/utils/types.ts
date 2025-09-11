export interface KPIBase {
  costoTotal: number;
  valorTotal: number;
  ganancia: number;
  totalHoras: number;
  productividadPromedio: number;
  cantidadReportes: number;
  cantidadTrabajadores: number;
}

export interface BigQueryRow {
  id_reporte?: string | number;
  fecha_reporte?: string;
  actividad?: string;
  rut_trabajador?: string;
  nombre_trabajador?: string;
  horas?: number;
  costo?: number;
  productividad?: number;
  metrado?: number;
  valor?: number;
  [key: string]: any; // Para otras propiedades que puedan venir de BigQuery
}

export interface AIAnalysisInsights {
  mainPoints: string[];
  recommendations: string[];
  productivityTrend: string;
  costTrend: string;
  keyActivities: string[];
}

export interface AIAnalysisResult {
  text: string;
  insights: AIAnalysisInsights;
  dataTimestamp: string;
  queryType: string;
}
