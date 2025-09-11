// Funciones auxiliares para extraer información del texto generado por IA

/**
 * Extrae una sección de texto basada en palabras clave
 * @param text Texto completo para analizar
 * @param keywords Palabras clave que indican el inicio de una sección
 * @returns Array de frases que forman parte de la sección
 */
export function extractSectionFromText(text: string, keywords: string[]): string[] {
  const lines = text.split('\n');
  const results: string[] = [];
  let inSection = false;
  let sectionEndCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Si la línea está vacía, la saltamos
    if (line.length === 0) continue;
    
    // Detectar inicio de sección
    if (!inSection) {
      const hasKeyword = keywords.some(keyword => 
        line.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        inSection = true;
        // No incluimos la línea del título de la sección
        continue;
      }
    } 
    // Procesar líneas dentro de la sección
    else {
      // Detectar posible fin de sección (línea que parece título)
      if (line.endsWith(':') || 
          (line.length < 30 && (line.toUpperCase() === line || line.match(/^\d+\.\s/)))) {
        sectionEndCount++;
        if (sectionEndCount > 1) {
          inSection = false;
          break;
        }
        continue;
      }
      
      // Si es una línea numerada o con viñetas, añadirla
      if (line.match(/^(\d+\.\s|\*\s|\-\s)/) || line.length > 20) {
        // Eliminar prefijos numerados o con viñetas
        const cleanLine = line.replace(/^(\d+\.\s|\*\s|\-\s)/, '').trim();
        if (cleanLine.length > 5) { // Evitar líneas muy cortas
          results.push(cleanLine);
        }
      }
    }
  }
  
  return results;
}

/**
 * Detecta la tendencia en un texto para un concepto específico
 * @param text Texto para analizar
 * @param concept Concepto a buscar (ej: "productividad", "costos")
 * @returns Tendencia identificada como texto
 */
export function detectTrend(text: string, concept: string): string {
  const lowerText = text.toLowerCase();
  
  // Búsqueda de patrones específicos para cada concepto
  if (lowerText.includes(`${concept} aument`) || 
      lowerText.includes(`incremento de ${concept}`) || 
      lowerText.includes(`mejora en ${concept}`)) {
    return "aumentando";
  }
  
  if (lowerText.includes(`${concept} disminu`) || 
      lowerText.includes(`reducción de ${concept}`) || 
      lowerText.includes(`bajada en ${concept}`)) {
    return "disminuyendo";
  }
  
  if (lowerText.includes(`${concept} estable`) || 
      lowerText.includes(`${concept} constante`) || 
      lowerText.includes(`${concept} mantenido`)) {
    return "estable";
  }
  
  if (lowerText.includes(`${concept} preocupante`) || 
      lowerText.includes(`problema con ${concept}`) || 
      lowerText.includes(`${concept} crítico`)) {
    return "crítico";
  }
  
  if (lowerText.includes(`${concept} mejorado`) || 
      lowerText.includes(`mejora de ${concept}`)) {
    return "mejorando";
  }
  
  // Si no encontramos un patrón claro, devolvemos un valor por defecto
  return "sin datos suficientes";
}
