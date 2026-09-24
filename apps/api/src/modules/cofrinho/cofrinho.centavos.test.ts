import { describe, expect, it } from 'vitest';

import { deCentavos, paraCentavos } from './cofrinho.centavos.js';

describe('centavos do cofrinho', () => {
  it.each([
    ['0', 0],
    ['0.1', 10],
    ['0.10', 10],
    ['12.34', 1234],
    ['9999999999.99', 999_999_999_999],
  ])('paraCentavos("%s") = %d sem erro de ponto flutuante', (valor, centavos) => {
    expect(paraCentavos(valor)).toBe(centavos);
  });

  it('rejeita formato fora de decimal(12,2) citando o valor recebido', () => {
    expect(() => paraCentavos('1.234')).toThrow(/recebido "1.234"/);
    expect(() => paraCentavos('abc')).toThrow(/esperado decimal/);
  });

  it('deCentavos formata com 2 casas, inclusive negativo', () => {
    expect(deCentavos(30)).toBe('0.30');
    expect(deCentavos(123456)).toBe('1234.56');
    expect(deCentavos(-5)).toBe('-0.05');
  });
});
