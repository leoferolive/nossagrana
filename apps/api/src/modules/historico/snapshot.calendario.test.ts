import { describe, expect, it } from 'vitest';

import { dataLocalDe, ehUltimoDiaDoMes, getMesReferencia } from './snapshot.calendario.js';

const SP = 'America/Sao_Paulo';

describe('ehUltimoDiaDoMes (fuso America/Sao_Paulo)', () => {
  it('30/03 23:55 BRT (02:55Z do dia 31) NÃO é o último dia de março', () => {
    expect(ehUltimoDiaDoMes(new Date('2026-03-31T02:55:00Z'), SP)).toBe(false);
  });

  it('31/03 23:55 BRT (02:55Z do dia 1) é o último dia e fecha 2026-03', () => {
    const agora = new Date('2026-04-01T02:55:00Z');
    expect(ehUltimoDiaDoMes(agora, SP)).toBe(true);
    expect(getMesReferencia(agora, SP)).toBe('2026-03');
  });

  it('fevereiro de ano não bissexto termina no dia 28', () => {
    expect(ehUltimoDiaDoMes(new Date('2027-03-01T02:55:00Z'), SP)).toBe(true);
    expect(ehUltimoDiaDoMes(new Date('2027-02-28T02:55:00Z'), SP)).toBe(false);
    expect(getMesReferencia(new Date('2027-03-01T02:55:00Z'), SP)).toBe('2027-02');
  });

  it('fevereiro de ano bissexto termina no dia 29', () => {
    expect(ehUltimoDiaDoMes(new Date('2028-03-01T02:55:00Z'), SP)).toBe(true);
    expect(ehUltimoDiaDoMes(new Date('2028-02-29T02:55:00Z'), SP)).toBe(false);
    expect(ehUltimoDiaDoMes(new Date('2028-02-28T12:00:00Z'), SP)).toBe(false);
    expect(getMesReferencia(new Date('2028-03-01T02:55:00Z'), SP)).toBe('2028-02');
  });

  it('mês de 30 dias: 30/04 é o último, 29/04 não', () => {
    expect(ehUltimoDiaDoMes(new Date('2026-05-01T02:55:00Z'), SP)).toBe(true);
    expect(ehUltimoDiaDoMes(new Date('2026-04-30T02:55:00Z'), SP)).toBe(false);
    expect(getMesReferencia(new Date('2026-05-01T02:55:00Z'), SP)).toBe('2026-04');
  });

  it('virada de ano: 31/12 23:55 BRT fecha 2026-12', () => {
    const agora = new Date('2027-01-01T02:55:00Z');
    expect(ehUltimoDiaDoMes(agora, SP)).toBe(true);
    expect(getMesReferencia(agora, SP)).toBe('2026-12');
  });
});

describe('dataLocalDe', () => {
  it('devolve ano, mês e dia no fuso pedido, não no do processo', () => {
    expect(dataLocalDe(new Date('2026-04-01T02:55:00Z'), SP)).toEqual({
      ano: 2026,
      mes: 3,
      dia: 31,
    });
    expect(dataLocalDe(new Date('2026-04-01T02:55:00Z'), 'UTC')).toEqual({
      ano: 2026,
      mes: 4,
      dia: 1,
    });
  });
});
