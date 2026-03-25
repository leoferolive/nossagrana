import { describe, expect, it } from 'vitest';

import { chunk } from './array.js';

describe('chunk', () => {
  it('divide array em chunks do tamanho especificado', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('retorna um unico chunk quando array cabe no tamanho', () => {
    expect(chunk([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });

  it('retorna array vazio quando input e vazio', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it('cada chunk tem exatamente o tamanho especificado exceto o ultimo', () => {
    const result = chunk([1, 2, 3, 4, 5, 6, 7], 3);
    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(3);
    expect(result[2]).toHaveLength(1);
  });

  it('funciona com size=1', () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it('funciona com array de tamanho exato ao chunk', () => {
    expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });
});
