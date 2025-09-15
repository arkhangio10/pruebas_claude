import { NextRequest, NextResponse } from 'next/server';

// La clave de API de Gemini se obtiene desde las variables de entorno del servidor
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // Obtener los datos enviados al proxy
    const body = await req.json();
    const { prompt, datos } = body;
    
    // Verificar que la clave de API está configurada
    if (!GEMINI_API_KEY) {
      console.error('Falta configurar GEMINI_API_KEY en el servidor');
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      );
    }
    
    // Preparar la solicitud a Gemini
    const geminiRequest = { 
      contents: [{ 
        parts: [{ 
          text: prompt + '\nDatos:\n' + JSON.stringify(datos).slice(0, 6000) 
        }] 
      }] 
    };
    
    // Llamada a la API de Gemini
    console.log('Enviando solicitud a Gemini API');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(geminiRequest)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en Gemini API:', errorText);
      return NextResponse.json(
        { error: `Error en API Gemini: ${response.status}` },
        { status: response.status }
      );
    }
    
    // Procesar la respuesta de Gemini
    const data = await response.json();
    
    // Extraer el texto generado
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Analizar y estructurar la respuesta
    // Aquí podríamos implementar lógica para extraer insights, recomendaciones, etc.
    
    return NextResponse.json({
      text: generatedText,
      // Extraer insights y recomendaciones sería una mejora futura
      insights: extractInsights(generatedText),
      recommendations: extractRecommendations(generatedText),
      trends: extractTrends(generatedText),
      raw: data
    });
    
  } catch (error: any) {
    console.error('Error en el proxy de Gemini:', error);
    return NextResponse.json(
      { error: error.message || 'Error procesando la solicitud' },
      { status: 500 }
    );
  }
}

// Funciones auxiliares para extraer información del texto generado
function extractInsights(text: string): string[] {
  // Versión simple: buscar párrafos que comiencen con números o guiones
  const insights: string[] = [];
  const lines = text.split('\n');
  
  let insightsSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.toLowerCase().includes('patrones') || 
        trimmedLine.toLowerCase().includes('hallazgos') || 
        trimmedLine.toLowerCase().includes('insights')) {
      insightsSection = true;
      continue;
    }
    
    if (insightsSection && trimmedLine.length > 15) {
      // Buscar líneas que parezcan elementos de lista
      if (/^(\d+\.|\-|\*)\s+/.test(trimmedLine)) {
        // Eliminar el prefijo del número o guión
        const insight = trimmedLine.replace(/^(\d+\.|\-|\*)\s+/, '');
        insights.push(insight);
      }
    }
    
    // Salir de la sección cuando encontremos otro título
    if (insightsSection && trimmedLine.endsWith(':')) {
      insightsSection = false;
    }
  }
  
  // Si no encontramos insights específicos, devolvemos algunos párrafos cortos
  if (insights.length === 0) {
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20 && p.trim().length < 150);
    return paragraphs.slice(0, 3);
  }
  
  return insights;
}

function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];
  const lines = text.split('\n');
  
  let recommendationsSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.toLowerCase().includes('recomendaciones') || 
        trimmedLine.toLowerCase().includes('acciones')) {
      recommendationsSection = true;
      continue;
    }
    
    if (recommendationsSection && trimmedLine.length > 15) {
      if (/^(\d+\.|\-|\*)\s+/.test(trimmedLine)) {
        const recommendation = trimmedLine.replace(/^(\d+\.|\-|\*)\s+/, '');
        recommendations.push(recommendation);
      }
    }
    
    if (recommendationsSection && trimmedLine.endsWith(':')) {
      recommendationsSection = false;
    }
  }
  
  return recommendations;
}

function extractTrends(text: string): Record<string, string> {
  const trends: Record<string, string> = {
    productividad: 'estable',
    costos: 'estable',
    calidad: 'estable',
    seguridad: 'estable'
  };
  
  // Buscar menciones específicas de tendencias
  if (text.match(/productividad.{1,20}(aument|mejor|subi|crec)/i)) {
    trends.productividad = 'aumentando';
  } else if (text.match(/productividad.{1,20}(disminu|reduci|baj|decrec)/i)) {
    trends.productividad = 'disminuyendo';
  }
  
  if (text.match(/cost.{1,20}(aument|subi|crec|elevad)/i)) {
    trends.costos = 'aumentando';
  } else if (text.match(/cost.{1,20}(disminu|reduci|baj|ahorro|econom)/i)) {
    trends.costos = 'disminuyendo';
  }
  
  if (text.match(/calidad.{1,20}(mejor|aument|optim)/i)) {
    trends.calidad = 'mejorando';
  } else if (text.match(/calidad.{1,20}(disminu|reduci|baj|problem)/i)) {
    trends.calidad = 'empeorando';
  }
  
  if (text.match(/seguridad.{1,20}(mejor|aument|reducc|incidente|accidente)/i)) {
    trends.seguridad = 'mejorando';
  } else if (text.match(/seguridad.{1,20}(incidente|accidente|riesgo|peligro)/i)) {
    trends.seguridad = 'necesita atención';
  }
  
  return trends;
}
