import { describe, it, expect } from 'vitest';

import { formatBRL, formatBRLNumber } from './formatting';

describe('formatBRL (string input)', () => {
  it('formats a positive value as BRL currency', () => {
    const result = formatBRL('1234.56');
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });

  it('formats zero', () => {
    const result = formatBRL('0');
    expect(result).toContain('0,00');
    expect(result).toContain('R$');
  });

  it('formats a negative value', () => {
    const result = formatBRL('-500.00');
    expect(result).toContain('500,00');
    expect(result).toContain('R$');
  });

  it('formats a value with no decimal places', () => {
    const result = formatBRL('1000');
    expect(result).toContain('1.000,00');
  });

  it('formats a small value', () => {
    const result = formatBRL('0.50');
    expect(result).toContain('0,50');
  });
});

describe('formatBRLNumber (number input)', () => {
  it('formats a positive number as BRL currency', () => {
    const result = formatBRLNumber(1234.56);
    expect(result).toContain('1.234,56');
    expect(result).toContain('R$');
  });

  it('formats zero', () => {
    const result = formatBRLNumber(0);
    expect(result).toContain('0,00');
    expect(result).toContain('R$');
  });

  it('formats a negative number', () => {
    const result = formatBRLNumber(-500);
    expect(result).toContain('500,00');
    expect(result).toContain('R$');
  });
});
