"use client";
import React from 'react';
import { corregirYActualizarReporte } from '@/services/reportesService';

// Constantes de costos
const COSTOS_POR_HORA = {
  'OPERARIO': 23.00,
  'OFICIAL': 18.09,
  'PEON': 16.38,
  'SIN CATEGORÍA': 0
} as const;

type DetalleActividad = {
  actividad?: string;
  metrados?: string | number;
  metrado?: string | number;
  metradoP?: string | number;
  precioUnitario?: number;
  valorTotal?: number;
  causas?: string;
  comentarios?: string;
};

type DetalleMO = {
  trabajador?: string;
  categoria?: string;
  dni?: string;
  especificacion?: string;
  totalHoras?: number;
  costoMO?: number;
  horasArray?: string[];
  item?: number | string;
  observacion?: string;
};

// Función de validación
const validarDatosAntesSave = (actividades: any[], manoObra: any[]): boolean => {
  // Validar actividades - solo validar si tienen un valor y es negativo
  for (const act of actividades) {
    // No forzar validación de metrados si no se han modificado
    const metradoValue = act.metradoE || act.metrado || act.metrados;
    if (metradoValue !== undefined && metradoValue !== '' && Number(metradoValue) < 0) {
      alert(`Error: Metrado ejecutado inválido en actividad ${act.actividad}`);
      return false;
    }
  }
  
  // Validar mano de obra
  for (const mo of manoObra) {
    // Si no hay horasArray, inicializar como array vacío para permitir guardar
    if (!Array.isArray(mo.horasArray)) {
      mo.horasArray = new Array(actividades.length).fill('0');
    }
    
    // Validar cada hora
    for (const h of mo.horasArray) {
      if (h && (isNaN(Number(h)) || Number(h) < 0 || Number(h) > 24)) {
        alert(`Error: Horas inválidas (${h}) para ${mo.trabajador}`);
        return false;
      }
    }
  }
  
  return true;
};

export interface ReporteDetalleData {
  id: string;
  elaboradoPor: string;
  fecha: string;
  bloque: string;
  // estado y error campos eliminados según requerimiento
  enlaceDrive?: string;
  enlaceCarpeta?: string;
  spreadsheetUrl?: string;
  totalValorizado?: number;
  totalTrabajadores?: number;
  totalActividades?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  reporte?: ReporteDetalleData;
  actividades?: DetalleActividad[];
  manoObra?: DetalleMO[];
}

const ReporteDetalleModal: React.FC<Props> = ({ open, onClose, reporte, actividades = [], manoObra = [] }) => {
  if (!open || !reporte) return null;

  const fmtMoney = (n?: number) => (n ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });

  const [editMode, setEditMode] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingHours, setEditingHours] = React.useState(false);
  const [actividadesEdit, setActividadesEdit] = React.useState(actividades);
  const [manoObraEdit, setManoObraEdit] = React.useState(manoObra);

  React.useEffect(() => {
    // Al abrir/cambiar de reporte, resetear estado de edición
    if (open && reporte?.id) {
      setEditMode(false);
      setEditingHours(false);
      setActividadesEdit(actividades);
      setManoObraEdit(manoObra);
    }
  }, [open, reporte?.id, actividades, manoObra]);

  const handleActividadChange = (idx: number, field: string, value: string) => {
    // SOLO permitir editar metradoE
    if (field !== 'metradoE') {
      return; // Ignorar cualquier otro cambio
    }
    
    setActividadesEdit(prev => {
      const next = [...prev];
      const current = { ...next[idx] } as any;
      
      // Actualizar el metrado ejecutado
      const valorNumerico = value === '' ? 0 : Number(value);
      current.metradoE = valorNumerico;
      current.metrado = valorNumerico; // Sincronizar ambos campos
      
      // Recalcular valor total automáticamente (siempre calculado, nunca editable directamente)
      const precio = Number(current.precioUnitario || 0);
      current.valorTotal = valorNumerico * precio;
      
      next[idx] = current;
      return next;
    });
  };

  // Mantener handleMOChange para compatibilidad con la UI existente
  const handleMOChange = (idx: number, field: string, value: string) => {
    setManoObraEdit(prev => {
      const next = [...prev];
      const current = { ...next[idx] } as any;
      
      if (field === 'categoria') {
        // Si cambia la categoría, actualizar el valor y recalcular costo
        current.categoria = value;
        
        // Recalcular costo MO basado en categoría
        const categoria = (value || '').toUpperCase();
        const costoHora = COSTOS_POR_HORA[categoria as keyof typeof COSTOS_POR_HORA] || 0;
        current.costoMO = (current.totalHoras || 0) * costoHora;
      } else if (field === 'totalHoras') {
        // Si cambian las horas totales directamente
        const horas = value === '' ? 0 : Number(value);
        current.totalHoras = horas;
        
        // Recalcular costo MO
        const categoria = (current.categoria || '').toUpperCase();
        const costoHora = COSTOS_POR_HORA[categoria as keyof typeof COSTOS_POR_HORA] || 0;
        current.costoMO = horas * costoHora;
      } else {
        // Para otros campos (trabajador, dni, especificacion, observacion)
        current[field] = value;
      }
      
      next[idx] = current;
      return next;
    });
  };
  
  const handleHorasActividad = (trabIdx: number, actIdx: number, value: string) => {
    // Marcar que estamos editando horas
    if (!editingHours) {
      setEditingHours(true);
    }
    
    setManoObraEdit(prev => {
      const next = [...prev];
      const current = { ...next[trabIdx] } as any;
      
      // Inicializar array de horas si no existe
      if (!Array.isArray(current.horasArray)) {
        current.horasArray = new Array(actividadesEdit.length).fill('0');
      }
      
      // Actualizar horas para esta actividad específica
      current.horasArray[actIdx] = value === '' ? '0' : value;
      
      // Recalcular total de horas
      const totalHoras = current.horasArray.reduce((sum: number, h: string) => 
        sum + (parseFloat(h) || 0), 0
      );
      current.totalHoras = totalHoras;
      
      // Recalcular costo MO basado en categoría
      const categoria = (current.categoria || '').toUpperCase();
      const costoHora = COSTOS_POR_HORA[categoria as keyof typeof COSTOS_POR_HORA] || 0;
      current.costoMO = totalHoras * costoHora;
      
      next[trabIdx] = current;
      return next;
    });
  };

  const handleSaveChanges = async () => {
    try {
      // Validar datos antes de guardar
      if (!validarDatosAntesSave(actividadesEdit, manoObraEdit)) {
        return; // Detener si la validación falla
      }
      
      setSaving(true);
      
      const dataParcial: any = {
        notasRectificacion: `Ediciones manuales ${new Date().toISOString()}`,
        totalActividades: actividadesEdit?.length,
        totalTrabajadores: manoObraEdit?.length,
        
        // Datos completos de actividades y mano de obra
        actividades: actividadesEdit.map(act => ({
          ...act,
          proceso: act.actividad,
          metradoE: Number(act.metrado ?? act.metrados ?? 0),
          metradoP: Number(act.metradoP ?? 0),
          precioUnitario: Number(act.precioUnitario ?? 0),
          valorTotal: Number(act.valorTotal ?? 0)
        })),
        
        manoObra: manoObraEdit.map(mo => ({
          ...mo,
          nombre: mo.trabajador,
          totalHoras: Number(mo.totalHoras ?? 0),
          costoMO: Number(mo.costoMO ?? 0),
          horas: mo.horasArray || []
        }))
      };
      
      await corregirYActualizarReporte(reporte.id, dataParcial, true);
      
      setEditMode(false);
      setEditingHours(false);
      
      // Limpiar TODO el caché local
      if (typeof window !== 'undefined') {
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.includes('costos:') || 
          key.includes('productividad:') || 
          key.includes('trabajadores:') ||
          key.includes('reportes:') ||
          key.includes('dashboard:') ||
          key.includes('resumen:')
        );
        
        cacheKeys.forEach(key => localStorage.removeItem(key));
        
        // Forzar recarga completa después de un pequeño delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
      
      alert('Cambios guardados y agregaciones actualizadas correctamente');
    } catch (e) {
      console.error('Error guardando cambios:', e);
      alert('Error al guardar. Ver consola para detalles.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-[95vw] max-w-5xl max-h-[90vh] overflow-auto rounded-lg shadow-lg border">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detalles del Reporte</h3>
          <div className="flex gap-2">
            {editMode ? (
              <button
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded disabled:opacity-60"
                onClick={handleSaveChanges}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            ) : (
              <button
                className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-3 py-1.5 rounded"
                onClick={() => setEditMode(true)}
              >
                Corregir Reporte
              </button>
            )}
            <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm px-3 py-1.5 rounded" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <h4 className="font-medium mb-2">Información General</h4>
            <div className="text-sm space-y-1">
              <div><span className="font-semibold">ID:</span> {reporte.id}</div>
              <div><span className="font-semibold">Fecha:</span> {reporte.fecha}</div>
              <div><span className="font-semibold">Elaborado por:</span> {reporte.elaboradoPor}</div>
              <div><span className="font-semibold">Bloque:</span> {reporte.bloque}</div>
              {/* Estado y error eliminados según requerimiento */}
              <div className="flex gap-2 pt-1">
                {reporte.spreadsheetUrl && (
                  <a className="text-green-700 underline" href={reporte.spreadsheetUrl} target="_blank" rel="noreferrer">Ver Sheet</a>
                )}
                {reporte.enlaceDrive && (
                  <a className="text-blue-700 underline" href={reporte.enlaceDrive} target="_blank" rel="noreferrer">Ver Drive</a>
                )}
                {reporte.enlaceCarpeta && (
                  <a className="text-yellow-700 underline" href={reporte.enlaceCarpeta} target="_blank" rel="noreferrer">Ver Carpeta</a>
                )}
              </div>
            </div>
          </div>
          <div className="border rounded p-3">
            <h4 className="font-medium mb-2">Resumen Financiero y Laboral</h4>
            <div className="text-sm space-y-1">
              <div><span className="font-semibold">Actividades:</span> {reporte.totalActividades ?? actividades.length}</div>
              <div><span className="font-semibold">Trabajadores:</span> {reporte.totalTrabajadores ?? manoObra.length}</div>
              <div><span className="font-semibold">Costo MO:</span> {fmtMoney(manoObra.reduce((s, x) => s + (x.costoMO || 0), 0))}</div>
              <div><span className="font-semibold">Valor Metrado:</span> {fmtMoney(actividades.reduce((s, x) => s + (x.valorTotal || 0), 0))}</div>
              <div><span className="font-semibold">Ganancia:</span> {fmtMoney((actividades.reduce((s, x) => s + (x.valorTotal || 0), 0)) - (manoObra.reduce((s, x) => s + (x.costoMO || 0), 0)))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Actividades Detalladas</h4>
            {editMode && !editingHours && (
              <button 
                onClick={() => setEditingHours(true)}
                className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                title="Ir a la edición de horas por actividad"
              >
                Ir a edición de horas
              </button>
            )}
          </div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Actividad</th>
                  <th className="px-3 py-2 text-left">Ubicación</th>
                  <th className="px-3 py-2 text-left">Metrado</th>
                  <th className="px-3 py-2 text-right">Valor Total</th>
                  <th className="px-3 py-2 text-left">Causas de No Cumplimiento</th>
                  <th className="px-3 py-2 text-left">Comentarios</th>
                </tr>
              </thead>
              <tbody key={editMode ? 'edit-acts' : 'view-acts'}>
                {actividadesEdit.map((a: any, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-600">{a.numero || (idx + 1)}</td>
                    <td className="px-3 py-2">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-48 p-1 border rounded bg-white"
                          value={a.actividad || ''}
                          onChange={e => handleActividadChange(idx, 'actividad', e.target.value)}
                        />
                      ) : (
                        a.actividad
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-40 p-1 border rounded bg-white"
                          value={a.ubicacion || ''}
                          onChange={e => handleActividadChange(idx, 'ubicacion', e.target.value)}
                        />
                      ) : (
                        a.ubicacion || '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editMode ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className={`w-24 p-1 border rounded ${editingHours ? 'bg-gray-100' : 'bg-white'}`}
                            value={(a.metradoE || a.metrado || a.metrados) ?? ''}
                            onChange={e => handleActividadChange(idx, 'metradoE', e.target.value)}
                            disabled={editingHours}
                            title={editingHours ? "Finalice la edición de horas antes de modificar metrados" : ""}
                          />
                          <span className="text-gray-500 ml-1">{a.unidad || ''}</span>
                          {a.metradoP ? <span className="text-xs text-gray-500 ml-1">(Plan: {a.metradoP})</span> : ''}
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{(a.metradoE || a.metrado || a.metrados) as any}</span>
                          {a.unidad ? <span className="text-gray-500 ml-1">{a.unidad}</span> : ''}
                          {a.metradoP ? <span className="text-xs text-gray-500 ml-1">(Plan: {a.metradoP})</span> : ''}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtMoney(a.valorTotal as number)}
                    </td>
                    <td className="px-3 py-2">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-64 p-1 border rounded bg-white"
                          value={a.causas || ''}
                          onChange={e => handleActividadChange(idx, 'causas', e.target.value)}
                        />
                      ) : (
                        a.causas || 'N/A'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-64 p-1 border rounded bg-white"
                          value={a.comentarios || ''}
                          onChange={e => handleActividadChange(idx, 'comentarios', e.target.value)}
                        />
                      ) : (
                        a.comentarios
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4">
          <h4 className="font-medium mb-2">Mano de Obra Detallada</h4>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">N°</th>
                  <th className="px-3 py-2 text-left">Trabajador</th>
                  <th className="px-3 py-2 text-left">DNI</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-left">Especificación</th>
                  <th className="px-3 py-2 text-right">Horas</th>
                  <th className="px-3 py-2 text-right">Costo MO</th>
                  <th className="px-3 py-2 text-left">Observación</th>
                </tr>
              </thead>
              <tbody key={editMode ? 'edit-mo' : 'view-mo'}>
                {manoObraEdit.map((m, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-600">{m.item || (idx + 1)}</td>
                    <td className="px-3 py-2 font-medium">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-48 p-1 border rounded bg-white"
                          value={m.trabajador || ''}
                          onChange={e => handleMOChange(idx, 'trabajador', e.target.value)}
                        />
                      ) : (
                        m.trabajador
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-32 p-1 border rounded bg-white"
                          value={m.dni || ''}
                          onChange={e => handleMOChange(idx, 'dni', e.target.value)}
                        />
                      ) : (
                        m.dni || '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-32 p-1 border rounded bg-white"
                          value={m.categoria || ''}
                          onChange={e => handleMOChange(idx, 'categoria', e.target.value)}
                        />
                      ) : (
                        m.categoria
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-48 p-1 border rounded bg-white"
                          value={m.especificacion || ''}
                          onChange={e => handleMOChange(idx, 'especificacion', e.target.value)}
                        />
                      ) : (
                        m.especificacion || '-'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editMode ? (
                        <input
                          type="number"
                          className="w-20 p-1 border rounded text-right bg-white"
                          value={typeof m.totalHoras === 'number' ? m.totalHoras : (m.totalHoras || '')}
                          onChange={e => handleMOChange(idx, 'totalHoras', e.target.value)}
                        />
                      ) : (
                        <span className="font-medium">{typeof m.totalHoras === 'number' ? m.totalHoras.toFixed(1) : m.totalHoras || '0.0'}</span>
                      )}
                      {m.horasArray && m.horasArray.length > 0 && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({m.horasArray.join(', ')})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {editMode ? (
                        <input
                          type="number"
                          className="w-24 p-1 border rounded text-right bg-white"
                          value={m.costoMO ?? ''}
                          onChange={e => handleMOChange(idx, 'costoMO', e.target.value)}
                        />
                      ) : (
                        fmtMoney(m.costoMO)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-64 p-1 border rounded bg-white"
                          value={m.observacion || ''}
                          onChange={e => handleMOChange(idx, 'observacion', e.target.value)}
                        />
                      ) : (
                        m.observacion
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* NUEVA TABLA PARA EDITAR HORAS POR ACTIVIDAD */}
        {editMode && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-yellow-600">
                ⚠️ Editar Horas por Actividad
              </h4>
              <button 
                onClick={() => setEditingHours(false)}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                title="Permitir la edición de metrados"
              >
                Volver a edición de metrados
              </button>
            </div>
            <div className="overflow-auto border rounded bg-yellow-50">
              <table className="min-w-full text-sm">
                <thead className="bg-yellow-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Trabajador</th>
                    {actividadesEdit.map((act, idx) => (
                      <th key={idx} className="px-3 py-2 text-center">
                        Act. {idx + 1}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {manoObraEdit.map((trab, trabIdx) => (
                    <tr key={trabIdx} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {trab.trabajador}
                      </td>
                      {actividadesEdit.map((_, actIdx) => (
                        <td key={actIdx} className="px-3 py-2">
                          <input
                            type="number"
                            className="w-16 p-1 border rounded text-center bg-white"
                            value={trab.horasArray?.[actIdx] || '0'}
                            onChange={e => handleHorasActividad(trabIdx, actIdx, e.target.value)}
                            step="0.5"
                            min="0"
                            max="24"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-bold">
                        {trab.totalHoras?.toFixed(1) || '0.0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporteDetalleModal;
