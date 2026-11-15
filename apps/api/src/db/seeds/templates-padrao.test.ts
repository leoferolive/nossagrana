import { describe, expect, it } from 'vitest';

import { CATEGORIAS_PADRAO_DESPESA, CATEGORIAS_PADRAO_RECEITA } from './categorias-padrao.js';
import { TEMPLATES_PADRAO } from './templates-padrao.js';

describe('seeds padrão de uma família nova', () => {
  // Nova UI, Entrega 1: as categorias padrão eram gravadas sem acento.
  it('categorias padrão têm acento', () => {
    expect(CATEGORIAS_PADRAO_DESPESA).toEqual(
      expect.arrayContaining(['Alimentação', 'Saúde', 'Educação']),
    );
    expect(CATEGORIAS_PADRAO_RECEITA).toEqual(expect.arrayContaining(['Salário', 'Bônus']));
  });

  // O modelo acha a categoria pelo nome: renomear uma lista sem a outra deixa
  // o modelo sem categoria na criação da família.
  it.each(TEMPLATES_PADRAO)(
    'modelo "$nome" aponta para uma categoria padrão de $tipo',
    ({ categoria, tipo }) => {
      const padrao: readonly string[] =
        tipo === 'receita' ? CATEGORIAS_PADRAO_RECEITA : CATEGORIAS_PADRAO_DESPESA;

      expect(padrao).toContain(categoria);
    },
  );
});
