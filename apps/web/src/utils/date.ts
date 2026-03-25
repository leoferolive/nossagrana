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
