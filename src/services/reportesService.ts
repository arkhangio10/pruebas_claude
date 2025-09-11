import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

const rectificarReporteFn = httpsCallable(functions, 'rectificarReporte');

export async function corregirYActualizarReporte(
  reporteId: string,
  dataParcial: any,
  regenerarSheets: boolean = false
): Promise<any> {
  const payload = { reporteId, dataParcial, regenerarSheets } as any;
  const res: any = await rectificarReporteFn(payload);
  return res?.data;
}


