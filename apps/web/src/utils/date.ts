/**
 * Returns the current month in YYYY-MM format.
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Shifts a month reference (YYYY-MM) by a given delta (positive = forward, negative = backward).
 */
export function shiftMonth(mesReferencia: string, delta: number): string {
  const [year, month] = mesReferencia.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formats a YYYY-MM reference as a pt-BR label like "abril de 2026".
 *
 * Uses the numeric Date constructor because `new Date("YYYY-MM-01")` parses as
 * UTC midnight; in negative offsets (e.g. America/Sao_Paulo, GMT-3) it rolls
 * back to the previous day, returning the wrong month name.
 */
export function formatMesLabel(mesReferencia: string): string {
  const [year, month] = mesReferencia.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}
