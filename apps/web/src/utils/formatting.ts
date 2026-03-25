/**
 * Formats a string numeric value as Brazilian Real (BRL) currency.
 * Example: "1234.56" -> "R$ 1.234,56"
 */
export function formatBRL(valor: string): string {
  return parseFloat(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formats a numeric value as Brazilian Real (BRL) currency.
 * Used by chart components that work with numbers directly.
 * Example: 1234.56 -> "R$ 1.234,56"
 */
export function formatBRLNumber(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
