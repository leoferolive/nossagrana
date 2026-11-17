import { describe, expect, it } from 'vitest';

import { encontrarErroPostgres } from './encontrar-erro-postgres.js';

const violacao = Object.assign(new Error('duplicate key'), { code: '23505' });

describe('encontrarErroPostgres', () => {
  it('acha o erro no próprio objeto e em até dois níveis de cause', () => {
    expect(encontrarErroPostgres(violacao, '23505')).toBe(violacao);
    const embrulhado = new Error('query falhou', { cause: violacao });
    expect(encontrarErroPostgres(embrulhado, '23505')).toBe(violacao);
    const duplo = new Error('externo', { cause: embrulhado });
    expect(encontrarErroPostgres(duplo, '23505')).toBe(violacao);
  });

  it('devolve null para outro SQLSTATE, para valor que não é Error e além de 3 níveis', () => {
    expect(encontrarErroPostgres(violacao, '23503')).toBeNull();
    expect(encontrarErroPostgres({ code: '23505' }, '23505')).toBeNull();
    expect(encontrarErroPostgres(null, '23505')).toBeNull();
    const fundo = new Error('a', {
      cause: new Error('b', { cause: new Error('c', { cause: violacao }) }),
    });
    expect(encontrarErroPostgres(fundo, '23505')).toBeNull();
  });
});
