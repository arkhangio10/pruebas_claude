import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    // Obtener los datos del cuerpo de la solicitud
    const data = await request.json();
    
    // Validación básica
    if (!data.elaboradoPor || !data.fecha || !data.bloque) {
      return NextResponse.json({ 
        error: 'Faltan datos obligatorios para crear el reporte' 
      }, { status: 400 });
    }
    
    // Formatear datos para guardar
    const reporteData = {
      elaboradoPor: data.elaboradoPor,
      fecha: data.fecha,
      bloque: data.bloque,
      subcontratistaBloque: data.subcontratistaBloque || '',
      estado: 'PENDIENTE',
      fechaCreacion: new Date().toISOString(),
      valorizado: 0,
      trabajadores: 0,
      actividades: 0
    };
    
    // Guardar en Firestore
    const docRef = await adminDb.collection('reportes').add(reporteData);
    
    console.log(`Nuevo reporte creado con ID: ${docRef.id}`);
    
    return NextResponse.json({ 
      success: true,
      id: docRef.id,
      message: 'Reporte creado correctamente'
    });
    
  } catch (error) {
    console.error('Error al crear nuevo reporte:', error);
    return NextResponse.json({ 
      error: 'Error al procesar la solicitud',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
