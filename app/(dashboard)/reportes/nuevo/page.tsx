"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NuevoReportePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    elaboradoPor: '',
    fecha: new Date().toISOString().split('T')[0],
    bloque: '',
    subcontratistaBloque: '',
    estado: 'PENDIENTE'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reportes/nuevo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear el reporte');
      }

      const data = await response.json();
      alert('Reporte creado correctamente');
      router.push('/dashboard/reportes');
    } catch (err: any) {
      console.error('Error al crear reporte:', err);
      setError(err.message || 'Error al crear el reporte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Nuevo Reporte</h2>
        <button
          onClick={() => router.push('/dashboard/reportes')}
          className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md"
        >
          Volver a Reportes
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Elaborado Por
            </label>
            <input
              type="text"
              name="elaboradoPor"
              value={formData.elaboradoPor}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Nombre o email del responsable"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Fecha
            </label>
            <input
              type="date"
              name="fecha"
              value={formData.fecha}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Bloque
            </label>
            <input
              type="text"
              name="bloque"
              value={formData.bloque}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Ej: BLOQUE 1, BLOQUE 2-3, etc"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Subcontratista / Bloque
            </label>
            <input
              type="text"
              name="subcontratistaBloque"
              value={formData.subcontratistaBloque}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Nombre del subcontratista si aplica"
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {loading ? 'Creando...' : 'Crear Reporte'}
          </button>
        </div>
      </form>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-sm text-yellow-700">
        <p className="font-medium">Nota:</p>
        <p>Al crear un reporte nuevo, este quedará en estado PENDIENTE hasta que sea procesado por el sistema.</p>
        <p>Una vez creado, podrá subir los archivos necesarios o vincularlo con hojas de cálculo existentes.</p>
      </div>
    </div>
  );
}
