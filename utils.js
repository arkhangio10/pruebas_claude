/**
 * utils.js
 * 
 * Este archivo contiene constantes y funciones de ayuda que son reutilizadas 
 * en otras partes del backend.
 */

// Costos de mano de obra por categoría.
// COSTOS_POR_HORA:
// Fuente: valores proporcionados explícitamente por el usuario.
// No inventar ni derivar otros costos; cualquier categoría desconocida retorna 0.
const COSTOS_POR_HORA = Object.freeze({
  OPERARIO: 23.00,
  OFICIAL: 18.09,
  PEON: 16.38,
  "SIN CATEGORÍA": 0
});

/**
 * Devuelve el costo por hora para una categoría exacta (case-insensitive seguro).
 * Si la categoría no está definida, retorna 0 (no inventar datos).
 * @param {string} categoria
 * @returns {number}
 */
function obtenerCostoHora(categoria) {
  if (!categoria) return 0;
  const key = categoria.toUpperCase();
  return COSTOS_POR_HORA[key] !== undefined ? COSTOS_POR_HORA[key] : 0;
}

// Orden preferido para mostrar las categorías en los reportes.
const CATEGORIAS_ORDENADAS = ["PEON", "OPERARIO", "OFICIAL"];

/**
 * Extrae de forma segura el precio unitario de un objeto de actividad.
 * Busca en varios campos de nombre común (precio, precioUnitario, etc.).
 * @param {object} actividad - El objeto de la actividad.
 * @returns {number} El precio unitario encontrado o 0 si no se encuentra.
 */
function extraerPrecioUnitario(actividad) {
  if (!actividad) return 0;
  const camposAlternativos = ['precio', 'precioUnitario', 'precio_unitario', 'valorUnitario', 'pu'];
  for (const campo of camposAlternativos) {
    if (actividad[campo] !== undefined) {
      const valor = Number(actividad[campo]);
      if (!isNaN(valor)) return valor;
    }
  }
  return 0;
}

/**
 * Sanitiza un string para usarlo como ID en Firestore.
 * @param {string} str - String a sanitizar.
 * @returns {string} String sanitizado.
 */
function sanitizarId(str) {
  if (!str) return 'sin-id-' + Date.now();
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Eliminar caracteres no alfanuméricos excepto espacios y guiones
    .replace(/\s+/g, '-')     // Reemplazar espacios con guiones
    .replace(/-+/g, '-');     // Eliminar guiones múltiples consecutivos
}

/**
 * Calcula la semana ISO para una fecha dada.
 * @param {Date} fecha - Fecha para la cual calcular la semana ISO.
 * @returns {string} Semana en formato YYYY-WXX.
 */
function obtenerSemanaISO(fecha) {
  const date = new Date(fecha);
  const year = date.getFullYear();
  
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date - firstDayOfYear) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}

// Exportamos los módulos para que puedan ser usados en otros archivos.
module.exports = {
  COSTOS_POR_HORA,
  obtenerCostoHora,
  CATEGORIAS_ORDENADAS,
  extraerPrecioUnitario,
  sanitizarId,
  obtenerSemanaISO
};
