/**
 * Returns the current month in YYYY-MM format.
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Returns today's date in the device's timezone, in YYYY-MM-DD format.
 *
 * Uses the local getters because `toISOString()` returns the UTC date; after
 * 21h in America/Sao_Paulo (GMT-3) that is already the next day.
 */
export function getTodayLocalISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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

/**
 * Formats a YYYY-MM reference as a short pt-BR label like "nov. de 2026".
 *
 * Same reason as `formatMesLabel`: builds the date from numeric parts so the
 * month does not roll back in negative timezone offsets.
 */
export function formatMesCurto(mesReferencia: string): string {
  const [year, month] = mesReferencia.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats a date-only value (YYYY-MM-DD, as returned for `date` columns) as
 * "31/12/2026".
 *
 * Do not use for timestamps: those carry a time and `new Date(...)` already
 * converts them to the device's timezone. A date-only string parsed by
 * `new Date("2026-12-31")` is UTC midnight and shows the previous day in
 * America/Sao_Paulo.
 */
export function formatDataBR(dataISO: string): string {
  const [year, month, day] = dataISO.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}
