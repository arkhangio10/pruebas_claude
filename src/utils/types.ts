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

export interface Kpis {
  costoTotal?: number;
  valorTotal?: number;
  productividadPromedio?: number;
  totalHoras?: number;
  ganancia?: number;
  actividadMasProductiva?: { nombre: string; productividad: number };
  actividadMenosProductiva?: { nombre: string; productividad: number };
}

export interface DashboardData {
  kpis: Kpis;
  reportes: Reporte[];
  actividades?: any[];
  trabajadores?: any[];
}

export interface FiltrosDashboard {
  fechaInicio: string;
  fechaFin: string;
  modoDatos: 'firebase' | 'bigquery';
  tipoVista?: 'diario' | 'semanal' | 'mensual';
}

export interface Actividad {
  nombre: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  productividad?: number;
}

export interface Reporte {
  id: string;
  fecha: string;
  actividades: Actividad[];
  costoTotal: number;
  productividad?: number;
}
