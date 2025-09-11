// Cliente Gemini con modos: cloud, proxy, mock, api
export type GeminiMode = 'cloud' | 'proxy' | 'mock' | 'api';

const PROMPT_BASE = `Analiza estos datos de construcción:\nIdentifica:\n1. Patrones de productividad\n2. Anomalías o problemas\n3. Recomendaciones específicas\n4. Tendencias importantes\nResponde en español técnico para supervisores de obra.`;

const PROMPT_TEMPLATES = {
  general: PROMPT_BASE,
  costos: `Analiza estos datos de costos de construcción:\nIdentifica:\n1. Áreas con sobrecostos\n2. Oportunidades de ahorro\n3. Recomendaciones específicas\n4. Tendencias de gastos\nResponde en español técnico para supervisores de obra y gerentes financieros.`,
  productividad: `Analiza estos datos de productividad en construcción:\nIdentifica:\n1. Equipos y trabajadores más eficientes\n2. Cuellos de botella en los procesos\n3. Recomendaciones para optimizar\n4. Tendencias de rendimiento\nResponde en español técnico para supervisores de obra.`,
  seguridad: `Analiza estos datos de seguridad en obra:\nIdentifica:\n1. Patrones de incidentes o accidentes\n2. Áreas de mayor riesgo\n3. Recomendaciones preventivas específicas\n4. Tendencias de seguridad\nResponde en español técnico para supervisores de seguridad y obra.`
};

export interface GeminiOptions { 
  mode?: GeminiMode; 
  apiKey?: string;
  tipo?: keyof typeof PROMPT_TEMPLATES;
  customPrompt?: string;
}

export interface GeminiResponse {
  texto: string;
  insights?: string[];
  recommendations?: string[];
  trends?: Record<string, string>;
  error?: string;
}

export async function analizarDatosConstruccion(datos: any, opts: GeminiOptions = {}): Promise<GeminiResponse> {
  const mode: GeminiMode = opts.mode || 'api';
  const tipo = opts.tipo || 'general';
  
  // Modo simulado para desarrollo
  if (mode === 'mock') {
    return { 
      texto: 'Análisis simulado: productividad estable, sin anomalías críticas, continuar monitoreo.',
      insights: [
        'La productividad se mantiene estable en comparación con periodos anteriores',
        'No se detectan anomalías significativas en los datos analizados',
        'El rendimiento de las cuadrillas está dentro de los parámetros esperados'
      ],
      recommendations: [
        'Mantener el monitoreo continuo de las actividades',
        'Considerar incentivos para mejorar el rendimiento en tareas específicas'
      ],
      trends: {
        productividad: 'estable',
        costos: 'estable',
        seguridad: 'mejorando'
      }
    };
  }
  
  // Usar nuestra API interna
  if (mode === 'api') {
    const promptToUse = opts.customPrompt || PROMPT_TEMPLATES[tipo];
    const body = { 
      prompt: promptToUse, 
      datos,
      options: { tipo }
    };
    const res = await fetch('/api/ai', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error API IA: ${res.status} - ${errorText}`);
    }
    
    const data = await res.json();
    return {
      texto: data.analysis?.summary || JSON.stringify(data.analysis),
      insights: data.analysis?.insights,
      recommendations: data.analysis?.recommendations,
      trends: data.analysis?.trends
    };
  }
  
  // Proxy a través de nuestra API (para ocultar credenciales)
  if (mode === 'proxy') {
    const promptToUse = opts.customPrompt || PROMPT_TEMPLATES[tipo];
    const body = { prompt: promptToUse, datos };
    const url = '/api/gemini-proxy';
    const res = await fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error proxy Gemini: ${res.status} - ${errorText}`);
    }
    
    const data = await res.json();
    return {
      texto: data.text || JSON.stringify(data),
      insights: data.insights,
      recommendations: data.recommendations,
      trends: data.trends
    };
  }
  
  // Cloud directo (no recomendado desde cliente)
  const apiKey = opts.apiKey || process.env.NEXT_PUBLIC_GEMINI_KEY;
  if (!apiKey) throw new Error('Falta GEMINI apiKey');
  
  const promptToUse = opts.customPrompt || PROMPT_TEMPLATES[tipo];
  const res = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=' + apiKey, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ 
      contents: [{ 
        parts: [{ 
          text: promptToUse + '\nDatos:\n' + JSON.stringify(datos).slice(0,6000) 
        }] 
      }] 
    })
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini error: ${res.status} - ${errorText}`);
  }
  
  const data = await res.json();
  
  try {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
    return { texto: text };
  } catch (e) {
    return { 
      texto: 'Error procesando respuesta de Gemini',
      error: e instanceof Error ? e.message : 'Unknown error'
    };
  }
}
