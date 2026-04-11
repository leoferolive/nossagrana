import { describe, it, expect, vi, afterEach } from 'vitest';

import { formatMesLabel, getCurrentMonth, shiftMonth } from './date';

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
