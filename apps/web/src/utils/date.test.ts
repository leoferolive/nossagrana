import { describe, it, expect, vi, afterEach } from 'vitest';

import {
  formatDataBR,
  formatMesCurto,
  formatMesLabel,
  formatMesTitulo,
  getCurrentMonth,
  getTodayLocalISO,
  shiftMonth,
} from './date';

describe('getCurrentMonth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current month in YYYY-MM format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 2026
    expect(getCurrentMonth()).toBe('2026-03');
    vi.useRealTimers();
  });

  it('pads single-digit months with zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1)); // January 2026
    expect(getCurrentMonth()).toBe('2026-01');
    vi.useRealTimers();
  });

  it('handles December correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31)); // December 2026
    expect(getCurrentMonth()).toBe('2026-12');
    vi.useRealTimers();
  });
});

describe('shiftMonth', () => {
  it('shifts forward by 1 month', () => {
    expect(shiftMonth('2026-03', 1)).toBe('2026-04');
  });

  it('shifts backward by 1 month', () => {
    expect(shiftMonth('2026-03', -1)).toBe('2026-02');
  });

  it('rolls over to next year', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rolls back to previous year', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('shifts by multiple months', () => {
    expect(shiftMonth('2026-03', 3)).toBe('2026-06');
  });

  it('shifts backward by multiple months across year boundary', () => {
    expect(shiftMonth('2026-02', -3)).toBe('2025-11');
  });
});

describe('formatMesLabel', () => {
  // Regressão: new Date("YYYY-MM-01") é parseado como UTC meia-noite.
  // Em TZ negativa (America/Sao_Paulo, GMT-3) isso vira o último dia do mês
  // anterior às 21h local, fazendo toLocaleString retornar o mês errado.
  it('retorna "abril de 2026" para "2026-04" mesmo em TZ negativa', () => {
    expect(formatMesLabel('2026-04')).toBe('abril de 2026');
  });

  it('retorna "janeiro de 2026" para "2026-01"', () => {
    expect(formatMesLabel('2026-01')).toBe('janeiro de 2026');
  });

  it('retorna "dezembro de 2026" para "2026-12"', () => {
    expect(formatMesLabel('2026-12')).toBe('dezembro de 2026');
  });

  it('retorna "março de 2026" para "2026-03"', () => {
    expect(formatMesLabel('2026-03')).toBe('março de 2026');
  });
});

describe('formatMesTitulo', () => {
  it('põe maiúscula só na primeira letra: "Novembro de 2026"', () => {
    expect(formatMesTitulo('2026-11')).toBe('Novembro de 2026');
  });

  it('mantém acento: "Março de 2026"', () => {
    expect(formatMesTitulo('2026-03')).toBe('Março de 2026');
  });
});

describe('getTodayLocalISO', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Regressão: toISOString() devolve a data em UTC; depois das 21h em São Paulo
  // (GMT-3) isso já é o dia seguinte.
  it('às 23:11 de 14/11 em São Paulo ainda é dia 14', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T02:11:00Z'));
    expect(getTodayLocalISO()).toBe('2026-11-14');
  });

  it('às 23:30 de 31/12 não vira o ano', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T02:30:00Z'));
    expect(getTodayLocalISO()).toBe('2026-12-31');
  });

  it('preenche mês e dia com zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T15:00:00Z'));
    expect(getTodayLocalISO()).toBe('2026-03-05');
  });
});

describe('formatMesCurto', () => {
  // Regressão: new Date("2026-11-01") é UTC; em São Paulo vira 31/10 e o
  // orçamento criado em novembro aparecia como "out. de 2026".
  it('retorna "nov. de 2026" para "2026-11"', () => {
    expect(formatMesCurto('2026-11')).toBe('nov. de 2026');
  });

  it('retorna "jan. de 2026" para "2026-01"', () => {
    expect(formatMesCurto('2026-01')).toBe('jan. de 2026');
  });
});

describe('formatDataBR', () => {
  // Regressão: new Date("2026-12-31") é UTC; em São Paulo vira 30/12.
  it('retorna "31/12/2026" para "2026-12-31"', () => {
    expect(formatDataBR('2026-12-31')).toBe('31/12/2026');
  });

  it('retorna "01/03/2026" para "2026-03-01"', () => {
    expect(formatDataBR('2026-03-01')).toBe('01/03/2026');
  });
});
