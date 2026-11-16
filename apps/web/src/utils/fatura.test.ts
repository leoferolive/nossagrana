import { describe, expect, it } from 'vitest';

import { vencimentoDaFatura } from './fatura';

describe('vencimentoDaFatura', () => {
  it('vencimento depois do fechamento cai no mesmo mês da fatura', () => {
    expect(vencimentoDaFatura('2026-11', 10, 17)).toBe('17/11');
  });

  it('vencimento antes do fechamento cai no mês seguinte', () => {
    expect(vencimentoDaFatura('2026-11', 28, 5)).toBe('05/12');
  });

  it('vencimento no mesmo dia do fechamento cai no mês seguinte', () => {
    expect(vencimentoDaFatura('2026-11', 10, 10)).toBe('10/12');
  });

  it('dezembro vira janeiro do ano seguinte', () => {
    expect(vencimentoDaFatura('2026-12', 28, 5)).toBe('05/01');
  });

  it('dia 31 num mês mais curto vence no último dia do mês', () => {
    expect(vencimentoDaFatura('2026-02', 1, 31)).toBe('28/02');
  });

  it('sem fechamento cadastrado, o vencimento é no mês da fatura', () => {
    expect(vencimentoDaFatura('2026-11', null, 5)).toBe('05/11');
  });

  it('sem vencimento cadastrado, não há data', () => {
    expect(vencimentoDaFatura('2026-11', 10, null)).toBeNull();
  });
});
