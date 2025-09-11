import { KPIBase } from '@/utils/types';

export interface ProductividadKpis extends KPIBase {
  totalHorasOperario: number;
  totalHorasOficial: number;
  totalHorasPeon: number;
  avancePromedio: number; // Realmente representa la suma total del avance (metrado)
}

export function createKpisProductividad(
  kpisBase: KPIBase, 
  sumaHorasOperario: number, 
  sumaHorasOficial: number, 
  sumaHorasPeon: number,
  avanceTotal: number = 0 // Suma total de metrado
): ProductividadKpis {
  return {
    ...kpisBase,
    totalHorasOperario: sumaHorasOperario,
    totalHorasOficial: sumaHorasOficial,
    totalHorasPeon: sumaHorasPeon,
    avancePromedio: avanceTotal // Mantenemos el nombre de la propiedad por compatibilidad
  };
}
