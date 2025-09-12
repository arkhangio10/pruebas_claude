"use client";
import React from 'react';
import { corregirYActualizarReporte } from '@/services/reportesService';

type DetalleActividad = {
  actividad?: string;
  metrados?: string | number;
  metrado?: string | number;
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
  onReprocesar?: (id: string) => void;
}

const ReporteDetalleModal: React.FC<Props> = ({ open, onClose, reporte, actividades = [], manoObra = [], onReprocesar }) => {
  if (!open || !reporte) return null;

  const fmtMoney = (n?: number) => (n ?? 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });

  const [editMode, setEditMode] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [actividadesEdit, setActividadesEdit] = React.useState(actividades);
  const [manoObraEdit, setManoObraEdit] = React.useState(manoObra);

  React.useEffect(() => {
    // Al abrir/cambiar de reporte, resetear estado de edición
    if (open && reporte?.id) {
      setEditMode(false);
      setActividadesEdit(actividades);
      setManoObraEdit(manoObra);
    }
  }, [open, reporte?.id, actividades, manoObra]);

  const handleActividadChange = (idx: number, field: string, value: string) => {
    setActividadesEdit(prev => {
      const next = [...prev];
      const current = { ...next[idx] } as any;
      // Campos numéricos comunes
      const numericFields = new Set(['metrado', 'metradoP', 'valorTotal']);
      current[field] = numericFields.has(field) ? (value === '' ? undefined : Number(value)) : value;
      next[idx] = current;
      return next;
    });
  };

  const handleMOChange = (idx: number, field: string, value: string) => {
    setManoObraEdit(prev => {
      const next = [...prev];
      const current = { ...next[idx] } as any;
      const numericFields = new Set(['totalHoras', 'costoMO']);
      current[field] = numericFields.has(field) ? (value === '' ? undefined : Number(value)) : value;
      next[idx] = current;
      return next;
    });
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      
      // ✅ ENVIAR DATOS COMPLETOS DE ACTIVIDADES Y MANO DE OBRA
      const dataParcial: any = {
        notasRectificacion: `Ediciones manuales ${new Date().toISOString()}`,
        totalActividades: actividadesEdit?.length ?? reporte.totalActividades,
        totalTrabajadores: manoObraEdit?.length ?? reporte.totalTrabajadores,
        
        // ✅ INCLUIR LAS ACTIVIDADES Y MANO DE OBRA EDITADAS
        actividades: actividadesEdit.map(act => ({
          actividad: act.actividad,
          proceso: act.actividad, // Mapear para compatibilidad
          ubicacion: act.ubicacion,
          metradoE: Number(act.metrado ?? act.metrados ?? 0),
          metradoP: Number(act.metradoP ?? 0),
          unidad: act.unidad,
          und: act.unidad, // Mapear para compatibilidad
          precioUnitario: Number(act.precioUnitario ?? 0),
          valorTotal: Number(act.valorTotal ?? 0),
          causas: act.causas,
          comentarios: act.comentarios,
        })),
        
        manoObra: manoObraEdit.map(mo => ({
          trabajador: mo.trabajador,
          nombre: mo.trabajador, // Mapear para compatibilidad
          dni: mo.dni,
          categoria: mo.categoria,
          especificacion: mo.especificacion,
          totalHoras: Number(mo.totalHoras ?? 0),
          costoMO: Number(mo.costoMO ?? 0),
          observacion: mo.observacion,
          // Si hay horas por actividad, incluirlas
          horas: mo.horasArray || []
        }))
      };
      
      // ✅ Indicar que queremos regenerar los cálculos
      await corregirYActualizarReporte(reporte.id, dataParcial, true);
      
      setEditMode(false);
      
      // ✅ INVALIDAR TODO EL CACHÉ
      if (typeof window !== 'undefined') {
        // Limpiar caché de localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('costos:') || 
              key.startsWith('productividad:') || 
              key.startsWith('trabajadores:') ||
              key.startsWith('reportes:') ||
              key.startsWith('dashboard:')) {
            localStorage.removeItem(key);
          }
        });
        
        // Forzar recarga completa de la página
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
      console.log('Cambios guardados y recalculados correctamente.');
    } catch (e) {
      console.error('Error guardando cambios:', e);
      alert('Hubo un error al guardar los cambios. Revisa la consola para más detalles.');
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
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded"
              onClick={() => onReprocesar && onReprocesar(reporte.id)}
            >
              Reprocesar Reporte
            </button>
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
          <h4 className="font-medium mb-2">Actividades Detalladas</h4>
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
                            className="w-24 p-1 border rounded bg-white"
                            value={(a.metrado ?? a.metrados) ?? ''}
                            onChange={e => handleActividadChange(idx, 'metrado', e.target.value)}
                          />
                          <input
                            type="text"
                            className="w-16 p-1 border rounded bg-white"
                            value={a.unidad || ''}
                            onChange={e => handleActividadChange(idx, 'unidad', e.target.value)}
                          />
                          <input
                            type="number"
                            className="w-24 p-1 border rounded bg-white"
                            placeholder="Plan"
                            value={a.metradoP ?? ''}
                            onChange={e => handleActividadChange(idx, 'metradoP', e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{(a.metrado ?? a.metrados) as any}</span>
                          {a.unidad ? <span className="text-gray-500 ml-1">{a.unidad}</span> : ''}
                          {a.metradoP ? <span className="text-xs text-gray-500 ml-1">(Plan: {a.metradoP})</span> : ''}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editMode ? (
                        <input
                          type="number"
                          className="w-28 p-1 border rounded text-right bg-white"
                          value={a.valorTotal ?? ''}
                          onChange={e => handleActividadChange(idx, 'valorTotal', e.target.value)}
                        />
                      ) : (
                        fmtMoney(a.valorTotal as number)
                      )}
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
      </div>
    </div>
  );
};

export default ReporteDetalleModal;
