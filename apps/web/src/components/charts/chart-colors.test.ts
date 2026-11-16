import { describe, expect, it } from 'vitest';

import { COR_DESPESA, COR_RECEITA, COR_SALDO, CORES_CATEGORIAS } from './chart-colors';

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrasteSobreBranco(hex: string): number {
  return 1.05 / (luminancia(hex) + 0.05);
}

describe('cores de gráfico', () => {
  it.each([...CORES_CATEGORIAS, COR_RECEITA, COR_DESPESA, COR_SALDO])(
    '%s tem 3:1 ou mais sobre branco',
    (cor) => {
      expect(contrasteSobreBranco(cor)).toBeGreaterThanOrEqual(3);
    },
  );

  it('as sete cores de categoria são diferentes entre si', () => {
    expect(CORES_CATEGORIAS).toHaveLength(7);
    expect(new Set(CORES_CATEGORIAS).size).toBe(7);
  });
});
