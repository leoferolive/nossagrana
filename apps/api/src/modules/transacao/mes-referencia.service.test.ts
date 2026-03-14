import { describe, expect, it } from 'vitest';

import { calcularMesReferencia } from './mes-referencia.service.js';

describe('calcularMesReferencia', () => {
  it('retorna mês da data para métodos não-crédito', () => {
    expect(calcularMesReferencia({ data: new Date('2026-03-10'), tipo: 'pix' })).toBe('2026-03');
    expect(calcularMesReferencia({ data: new Date('2026-03-10'), tipo: 'debito' })).toBe('2026-03');
    expect(calcularMesReferencia({ data: new Date('2026-03-10'), tipo: 'dinheiro' })).toBe(
      '2026-03',
    );
    expect(calcularMesReferencia({ data: new Date('2026-03-10') })).toBe('2026-03');
  });

  it('retorna mês atual quando transação é antes do fechamento (crédito)', () => {
    // Data 10, fechamento dia 15 → ainda está no mês atual
    expect(
      calcularMesReferencia({ data: new Date('2026-03-10'), tipo: 'credito', dataFechamento: 15 }),
    ).toBe('2026-03');
  });

  it('retorna mês atual quando transação é exatamente no dia do fechamento (crédito)', () => {
    // Data 15, fechamento dia 15 → ainda está no mês atual
    expect(
      calcularMesReferencia({ data: new Date('2026-03-15'), tipo: 'credito', dataFechamento: 15 }),
    ).toBe('2026-03');
  });

  it('retorna próximo mês quando transação é após o fechamento (crédito)', () => {
    // Data 16, fechamento dia 15 → já fechou, vai para abril
    expect(
      calcularMesReferencia({ data: new Date('2026-03-16'), tipo: 'credito', dataFechamento: 15 }),
    ).toBe('2026-04');
  });

  it('trata virada de ano corretamente (dezembro → janeiro)', () => {
    expect(
      calcularMesReferencia({ data: new Date('2026-12-20'), tipo: 'credito', dataFechamento: 15 }),
    ).toBe('2027-01');
  });

  it('retorna mês da data quando crédito sem dataFechamento', () => {
    expect(
      calcularMesReferencia({
        data: new Date('2026-03-20'),
        tipo: 'credito',
        dataFechamento: null,
      }),
    ).toBe('2026-03');
  });
});
