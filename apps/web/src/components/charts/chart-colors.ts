/**
 * Cores dos gráficos, em hexadecimal porque o SVG as recebe como atributo.
 * Todas têm pelo menos 3:1 sobre o fundo branco do cartão (ver chart-colors.test.ts).
 */
export const CORES_CATEGORIAS: readonly string[] = [
  '#0F6B3E',
  '#1F5F8B',
  '#5B3FA6',
  '#B37A00',
  '#B3261E',
  '#0E7C86',
  '#5A675F',
];

export const COR_RECEITA = '#0F6B3E';
// Saída em tom neutro (decisão 9 da nova UI): vermelho fica só para alerta.
export const COR_DESPESA = '#45524A';
export const COR_SALDO = '#1F5F8B';
