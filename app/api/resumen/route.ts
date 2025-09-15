import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { KPIBase } from '@/utils/types';

// Helper fechas
function listDatesInclusive(start: string, end: string): string[] {
  const res: string[] = [];
  
  // ✅ FIX: Usar UTC para evitar problemas de zona horaria
  const dStart = new Date(Date.UTC(
    parseInt(start.slice(0, 4)),
    parseInt(start.slice(5, 7)) - 1,
    parseInt(start.slice(8, 10))
  ));
  const dEnd = new Date(Date.UTC(
    parseInt(end.slice(0, 4)),
    parseInt(end.slice(5, 7)) - 1,
    parseInt(end.slice(8, 10))
  ));
  
  for (let d = new Date(dStart); d <= dEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    res.push(d.toISOString().slice(0, 10));
  }
  return res;
}
function weekISO(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7; // lunes=0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get('fechaInicio') || new Date().toISOString().slice(0,10);
    const fechaFin = searchParams.get('fechaFin') || fechaInicio;
    const tipoVista = searchParams.get('tipoVista') || 'diario';
    const modulo = searchParams.get('modulo') || 'costos'; // Nuevo: permite identificar el módulo para procesamiento específico
    const debug = searchParams.get('debug') === '1';
    const includeRaw = searchParams.get('raw') === '1';
    const forceDaily = searchParams.get('forceDaily') !== '0'; // Valor por defecto es true (forzar datos diarios siempre)

    // ✅ FIX: Validar que las fechas no sean futuras
    const hoy = new Date().toISOString().slice(0,10);
    if (fechaInicio > hoy) {
      return NextResponse.json({ 
        error: 'La fecha de inicio no puede ser futura',
        kpis: {}, 
        actividades: [], 
        columnasUso: { costoOperario: false, costoOficial: false, costoPeon: false }
      });
    }
    if (fechaFin > hoy) {
      return NextResponse.json({ 
        error: 'La fecha de fin no puede ser futura',
        kpis: {}, 
        actividades: [], 
        columnasUso: { costoOperario: false, costoOficial: false, costoPeon: false }
      });
    }

    // Construir lista de doc IDs para Dashboard_Resumenes
    let docIds: string[] = [];
    if (tipoVista === 'diario') docIds = [`diario_${fechaInicio}`];
    else if (tipoVista === 'semanal') docIds = [`semanal_${weekISO(fechaInicio)}`];
    else if (tipoVista === 'mensual') docIds = [`mensual_${fechaInicio.slice(0,7)}`];
    else docIds = listDatesInclusive(fechaInicio, fechaFin).map(d => `diario_${d}`);

    // Leer KPIs
    let costoTotal=0, valorTotal=0, ganancia=0, totalHoras=0, cantidadReportes=0, cantidadTrabajadores=0;
    for (const id of docIds) {
      const snap = await adminDb.collection('Dashboard_Resumenes').doc(id).get();
      if (snap.exists) {
        const m: any = (snap.data() as any).metricas || {};
        costoTotal += m.costoTotal || 0;
        valorTotal += m.valorTotal || 0;
        ganancia += m.ganancia || 0;
        totalHoras += m.totalHoras || 0;
        cantidadReportes += m.cantidadReportes || 0;
        cantidadTrabajadores += m.cantidadTrabajadores || 0;
      }
    }
  const productividadPromedioInicial = totalHoras ? (costoTotal/ totalHoras) : 0; // placeholder
  let kpis = { costoTotal, valorTotal, ganancia, totalHoras, productividadPromedio: productividadPromedioInicial, cantidadReportes, cantidadTrabajadores };

    // Nueva estrategia de actividades:
    // Siempre intentamos sumar claves DIARIAS dentro del rango solicitado.
    // Sólo si no hay datos diarios en absoluto y la vista es semanal/mensual usamos el agregado semanal/mensual.
    let tipoPeriodoInterno: 'diario' | 'semanal' | 'mensual' = 'diario';
    let clavesPeriodo: string[] = [];
    let rangoFechasDiarias: string[] = [];
    if (tipoVista === 'diario') {
      rangoFechasDiarias = [fechaInicio];
      clavesPeriodo = rangoFechasDiarias;
      tipoPeriodoInterno = 'diario';
    } else if (tipoVista === 'rango') {
      rangoFechasDiarias = listDatesInclusive(fechaInicio, fechaFin);
      clavesPeriodo = rangoFechasDiarias;
      tipoPeriodoInterno = 'diario';
    } else if (tipoVista === 'semanal') {
        // Usar directamente el rango recibido (frontend ya fija lunes-domingo). Si no trae 7 días, recalcular.
        rangoFechasDiarias = listDatesInclusive(fechaInicio, fechaFin);
        if (rangoFechasDiarias.length !== 7) {
          const base = new Date(fechaInicio + 'T00:00:00');
          const dayLocal = base.getDay();
          const diff = (dayLocal === 0 ? -6 : 1 - dayLocal);
          const lunes = new Date(base); lunes.setDate(base.getDate() + diff);
          const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
          rangoFechasDiarias = listDatesInclusive(lunes.toISOString().slice(0,10), domingo.toISOString().slice(0,10));
        }
      clavesPeriodo = rangoFechasDiarias; // usamos diarias
      tipoPeriodoInterno = 'diario';
    } else if (tipoVista === 'mensual') {
    // Normalizamos siempre al mes completo basado en fechaInicio
    const y = Number(fechaInicio.slice(0,4));
    const monthIndex = Number(fechaInicio.slice(5,7)) - 1; // 0-based
    const primero = `${y}-${String(monthIndex+1).padStart(2,'0')}-01`;
    const ultimoDate = new Date(Date.UTC(y, monthIndex + 1, 0));
    const ultimoStr = ultimoDate.toISOString().slice(0,10);
    const hoyStr = new Date().toISOString().slice(0,10);
    // Determinar si el mes está en curso y la fechaFin original es antes del último día (mes parcial)
    const mesActualStr = hoyStr.slice(0,7);
    const isCurrentMonth = fechaInicio.slice(0,7) === mesActualStr;
    const esMesParcial = isCurrentMonth && fechaFin < ultimoStr; // usuario aún no alcanzó fin de mes
    rangoFechasDiarias = listDatesInclusive(primero, esMesParcial ? fechaFin : ultimoStr);
    clavesPeriodo = rangoFechasDiarias;
    tipoPeriodoInterno = 'diario';
    // Guardamos flag global accesible más adelante (closure variable)
    (globalThis as any).__mesParcial = esMesParcial;
    }

    const actSnaps = await adminDb.collection('Actividades_Resumen').get();
    let columnasUso = { costoOperario:false, costoOficial:false, costoPeon:false };

    // Helpers para documentos potencialmente "aplanados" (con claves como "periodos.diario.2025-08-13.metrado")
    function isFlatDoc(obj: any) {
      return !obj?.acumulado && Object.keys(obj).some(k => k.startsWith('acumulado.'));
    }
    function readAcumulado(obj:any) {
      if (!obj) return {};
      if (obj.acumulado) return obj.acumulado; // estructura anidada normal
      // reconstruir desde claves aplanadas
      const res:any = {};
      for (const [k,v] of Object.entries(obj)) {
        if (k.startsWith('acumulado.')) {
          const campo = k.substring('acumulado.'.length);
            res[campo] = v; 
        }
      }
      return res;
    }
    function readPeriodo(obj:any, tipo:string, clave:string) {
      // estructura anidada
      const nested = obj?.periodos?.[tipo]?.[clave];
      if (nested) return nested;
      
      // intentar aplanado
      const prefix = `periodos.${tipo}.${clave}.`;
      const res:any = {};
      for (const [k,v] of Object.entries(obj||{})) {
        if (k.startsWith(prefix)) {
          const campo = k.substring(prefix.length);
          res[campo] = v;
        }
      }
      return res;
    }

  const setClaves = new Set(clavesPeriodo);
    // Pre-calcular fechas disponibles para diagnóstico (solo diario)
    const fechasConDatosGlobal: Record<string, number> = {};

  let actividades = actSnaps.docs.map(d => {
      const data: any = d.data();
      let metrado=0, horas=0, valor=0, costoMO=0, costoOperario=0, costoOficial=0, costoPeon=0;

      let hadPeriodData = false;
      let usedAggregateFallback: 'none' | 'weekly' | 'monthly' = 'none';
      const dailyDatesUsed: string[] = [];
      const includedKeys: string[] = []; const excludedKeys: string[] = [];
      // 0. Priorizar agregados semanales/mensuales si la vista lo permite
      if (!forceDaily && (tipoVista === 'semanal' || tipoVista === 'mensual')) {
        const tipoAgg = tipoVista === 'semanal' ? 'semanal' : 'mensual';
        const claveAgg = tipoAgg === 'semanal' ? weekISO(fechaInicio) : fechaInicio.slice(0,7);
        const prefixAgg = `periodos.${tipoAgg}.${claveAgg}.`;
        let found = false;
        // Si es mensual y el mes es parcial preferimos evitar el agregado completo (para no inflar con días futuros)
        const evitarAggPorMesParcial = tipoVista === 'mensual' && (globalThis as any).__mesParcial;
        for (const [k,v] of Object.entries(data)) {
          if (!k.startsWith(prefixAgg)) continue;
          if (evitarAggPorMesParcial) { found = false; break; }
          const campo = k.substring(prefixAgg.length);
          const num = Number(v) || 0;
          if (['metrado','horas','valor','costoMO','costoOperario','costoOficial','costoPeon'].includes(campo)) {
            found = true; hadPeriodData = true;
            switch(campo){
              case 'metrado': metrado = num; break;
              case 'horas': horas = num; break;
              case 'valor': valor = num; break;
              case 'costoMO': costoMO = num; break;
              case 'costoOperario': costoOperario = num; break;
              case 'costoOficial': costoOficial = num; break;
              case 'costoPeon': costoPeon = num; break;
            }
          }
        }
        if (found) usedAggregateFallback = tipoAgg === 'semanal' ? 'weekly' : 'monthly';
      }
      // 1. Intentar sumar solo diarios
      if (forceDaily || !(tipoVista === 'semanal' || tipoVista === 'mensual') || usedAggregateFallback === 'none') {
        const prefixDaily = 'periodos.diario.';
        const tmpDaily: Record<string, any> = {};
        for (const [k,v] of Object.entries(data)) {
          if (!k.startsWith(prefixDaily)) continue;
          const resto = k.substring(prefixDaily.length); // <fecha>.<campo>
          const dot = resto.indexOf('.'); if (dot === -1) continue;
          const fechaKey = resto.substring(0,dot); const campo = resto.substring(dot+1);
          if (!setClaves.has(fechaKey)) { continue; }
          (tmpDaily[fechaKey] ||= {})[campo] = Number(v)||0;
        }
        Object.entries(tmpDaily).forEach(([f, campos]: any) => {
          const anyVal = Object.values(campos).some((n:any)=> n>0);
          if (anyVal) { hadPeriodData = true; includedKeys.push(f); dailyDatesUsed.push(f); }
          metrado += campos.metrado||0; horas += campos.horas||0; valor += campos.valor||0; costoMO += campos.costoMO||0;
          costoOperario += campos.costoOperario||0; costoOficial += campos.costoOficial||0; costoPeon += campos.costoPeon||0;
        });
      }

  // 2. Fallback agregado ya se intentó; se elimina bloque duplicado.

      const acum = readAcumulado(data);
  // 3. Fallback final a acumulado: SOLO para vistas semanal/mensual (NO para rango manual)
  // ✅ FIX: Para rango manual, si no hay datos específicos del período, no mostrar datos acumulados
  // ✅ FIX CRÍTICO: NO usar datos acumulados para filtros semanales/mensuales si no hay datos del período
  // Esto evita mostrar todos los datos cuando no hay datos específicos del período seleccionado
  if (!hadPeriodData && (tipoVista === 'semanal' || tipoVista === 'mensual')) {
        // NO usar datos acumulados - dejar en 0 si no hay datos del período específico
        // if (acum.metrado) { metrado = acum.metrado; usedAggregateFallback = usedAggregateFallback==='none'?'monthly':usedAggregateFallback; }
        // if (acum.horas) { horas = acum.horas; }
        // if (acum.valor) { valor = acum.valor; }
        // if (acum.costoMO) { costoMO = acum.costoMO; }
        // if (acum.costoOperario) { costoOperario = acum.costoOperario; }
        // if (acum.costoOficial) { costoOficial = acum.costoOficial; }
        // if (acum.costoPeon) { costoPeon = acum.costoPeon; }
      }

      if (costoOperario>0) columnasUso.costoOperario = true;
      if (costoOficial>0) columnasUso.costoOficial = true;
      if (costoPeon>0) columnasUso.costoPeon = true;
      
      // Obtener las horas por tipo de trabajador directamente de los datos
      // Primero intentar leer desde los datos del periodo actual
      let horasOperario = 0;
      let horasOficial = 0;
      let horasPeon = 0;
      
      // Si estamos en modo forceDaily, agregamos las horas de los periodos diarios
      if (forceDaily || usedAggregateFallback === 'none') {
        // Sumar las horas de los periodos diarios
        const prefixDaily = 'periodos.diario.';
        for (const [k, v] of Object.entries(data)) {
          if (!k.startsWith(prefixDaily)) continue;
          
          const resto = k.substring(prefixDaily.length);
          const dot = resto.indexOf('.');
          if (dot === -1) continue;
          
          const fechaKey = resto.substring(0, dot);
          const campo = resto.substring(dot+1);
          
          if (!setClaves.has(fechaKey)) continue;
          
          if (campo === 'horasOperario') horasOperario += Number(v) || 0;
          if (campo === 'horasOficial') horasOficial += Number(v) || 0;
          if (campo === 'horasPeon') horasPeon += Number(v) || 0;
        }
      } 
      // Si no tenemos horas, intentar leer del acumulado
      if ((horasOperario + horasOficial + horasPeon) === 0) {
        horasOperario = acum.horasOperario || 0;
        horasOficial = acum.horasOficial || 0;
        horasPeon = acum.horasPeon || 0;
      }
      
      // Calculamos productividad como valor generado por hora de trabajo
      const productividad = horas > 0 ? valor / horas : 0;
      
      // Obtenemos la unidad de medida si está disponible
      const unidadMedida = data.unidadMedida || '';
      
      // Nuevo criterio: costoExpediente = valor del periodo seleccionado
      const costoExpediente = valor || 0;
      
      // La actividad base con datos comunes
      const actividadBase = { 
        id: d.id, 
        nombre: data.nombre || d.id, 
        metrado, 
        horas, 
        total: valor, 
        unidadMedida,
        productividad,
        horasOperario, 
        horasOficial, 
        horasPeon,
        costoManoObra: costoMO, 
        costoOperario, 
        costoOficial, 
        costoPeon, 
        costoExpediente, 
        hadPeriodData, 
        usedAggregateFallback 
      };
      
      // Definir la actividad según el módulo solicitado
      let actividad: any;
      
      if (modulo === 'productividad') {
        // Para módulo de productividad, enfocarse en horas y avance
        actividad = {
          ...actividadBase,
          // Mantener solo los campos relevantes para productividad
          id: actividadBase.id,
          nombre: actividadBase.nombre,
          metrado: actividadBase.metrado,
          unidadMedida: actividadBase.unidadMedida,
          horas: actividadBase.horas,
          horasOperario: actividadBase.horasOperario,
          horasOficial: actividadBase.horasOficial,
          horasPeon: actividadBase.horasPeon,
          productividad: actividadBase.productividad
        };
      } else {
        // Para el módulo de costos (default)
        actividad = actividadBase;
      }
      // Enlazar explícitamente fechas para que el frontend no dependa de _raw
      if (tipoVista === 'diario') {
        actividad.fecha = fechaInicio; // única fecha solicitada
      } else {
        actividad.fechasDetalle = dailyDatesUsed; // fechas diarias efectivamente sumadas
      }
      if (includeRaw) {
        actividad._raw = { requested: clavesPeriodo, tipoVista, dailyDatesUsed, aggregateFallback: usedAggregateFallback, flat: true, hadPeriodData, includedKeys, excludedKeys };
      }
      return actividad;
    }).sort((a,b)=> b.total - a.total);

    // Filtro: remover actividades totalmente vacías (todas las métricas relevantes en 0)
    actividades = actividades.filter(a => {
      const sum = (a.metrado||0) + (a.horas||0) + (a.total||0) + (a.costoManoObra||0) + (a.costoOperario||0) + (a.costoOficial||0) + (a.costoPeon||0);
      if (sum === 0) return false;
      if (tipoVista === 'semanal' || tipoVista === 'mensual') {
        // Mantener si hay datos diarios o agregado semanal/mensual (usedAggregateFallback != none)
        if ((!a.fechasDetalle || a.fechasDetalle.length === 0) && (a.usedAggregateFallback === 'none')) return false; // sin datos del periodo
      }
      return true;
    });

    // Derivar KPIs si los originales están en cero pero actividades tienen datos
    const sumaValor = actividades.reduce((s,a)=>s + (a.total||0),0);
    const sumaCosto = actividades.reduce((s,a)=>s + (a.costoManoObra||0),0);
    const sumaHoras = actividades.reduce((s,a)=>s + (a.horas||0),0);
    const sumaHorasOperario = actividades.reduce((s,a)=>s + (a.horasOperario||0),0);
    const sumaHorasOficial = actividades.reduce((s,a)=>s + (a.horasOficial||0),0);
    const sumaHorasPeon = actividades.reduce((s,a)=>s + (a.horasPeon||0),0);
    const sumaMetrado = actividades.reduce((s,a)=>s + (a.metrado||0),0); // Suma total de avance (metrado)
    const productividadPromedioCalculada = sumaHoras ? sumaValor / sumaHoras : 0;
    
    // KPIs base que se comparten entre módulos
    const kpisBase: KPIBase = {
      costoTotal: sumaCosto,
      valorTotal: sumaValor,
      ganancia: sumaValor - sumaCosto,
      totalHoras: sumaHoras,
      productividadPromedio: productividadPromedioCalculada,
      cantidadReportes: kpis.cantidadReportes || 0,
      cantidadTrabajadores: kpis.cantidadTrabajadores || 0
    };
    
    // Si no hay datos originales o estamos en modo productividad, usar los calculados
    if ((kpis.valorTotal === 0 && sumaValor > 0) || modulo === 'productividad') {
      if (modulo === 'productividad') {
        // Importar el creador de KPIs de productividad
        const { createKpisProductividad } = require('@/utils/productividadKpis');
        // KPIs específicos para productividad
        kpis = createKpisProductividad(
          kpisBase, 
          sumaHorasOperario, 
          sumaHorasOficial, 
          sumaHorasPeon, 
          sumaMetrado // Incluimos la suma total del avance (metrado)
        );
      } else {
        // KPIs para costos (default)
        kpis = kpisBase;
      }
    }

    return NextResponse.json({ 
      kpis, 
      actividades, 
      columnasUso, 
      debug: debug ? { 
        docIds, 
        tipoPeriodoInterno, 
        clavesPeriodo, 
        actividadesCount: actividades.length, 
        modulo,
        notas: 'fechasConDatos se informan solo para vista diaria', 
        forceDaily 
      } : undefined 
    });
  
  // Si hay debug, agregar para cada actividad los valores por periodo para analizar inconsistencias
  if (debug && includeRaw) {
    actividades.forEach(a => {
      if (a._raw) {
        a._raw.periodoData = []; // Array para ver periodos específicos por actividad
        if (tipoVista === 'semanal') {
          const claveAgg = weekISO(fechaInicio);
          const prefixAgg = `periodos.semanal.${claveAgg}.`;
          const actData = actSnaps.docs.find(d => d.id === a.id)?.data() as any;
          if (actData) {
            a._raw.periodoData.push({
              tipo: 'semanal',
              clave: claveAgg,
              valor: actData[prefixAgg + 'valor'] || 0,
              metrado: actData[prefixAgg + 'metrado'] || 0,
              horas: actData[prefixAgg + 'horas'] || 0,
              costoMO: actData[prefixAgg + 'costoMO'] || 0
            });
          }
        } else if (tipoVista === 'mensual') {
          const claveAgg = fechaInicio.slice(0,7);
          const prefixAgg = `periodos.mensual.${claveAgg}.`;
          const actData = actSnaps.docs.find(d => d.id === a.id)?.data() as any;
          if (actData) {
            a._raw.periodoData.push({
              tipo: 'mensual', 
              clave: claveAgg,
              valor: actData[prefixAgg + 'valor'] || 0,
              metrado: actData[prefixAgg + 'metrado'] || 0,
              horas: actData[prefixAgg + 'horas'] || 0,
              costoMO: actData[prefixAgg + 'costoMO'] || 0
            });
          }
        }
      }
    });
  }
  } catch (e:any) {
    console.error('API resumen error', e);
    return NextResponse.json({ error: e.message || 'Error interno' }, { status: 500 });
  }
}
