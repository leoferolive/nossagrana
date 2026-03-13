import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  categorias,
  convites,
  familias,
  solicitacoesEntrada,
  users,
  usuarioFamilia,
} from './schema.js';
import {
  CATEGORIAS_PADRAO_DESPESA,
  CATEGORIAS_PADRAO_RECEITA,
} from './seeds/categorias-padrao.js';

describe('database schema', () => {
  it('defines users table with required columns', () => {
    const columns = getTableColumns(users);

    expect(Object.keys(columns)).toEqual([
      'id',
      'nome',
      'email',
      'senhaHash',
      'dataCriacao',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.email.notNull).toBe(true);
    expect(columns.senhaHash.notNull).toBe(true);
    expect(columns.dataCriacao.notNull).toBe(true);
  });

  it('defines familias table with required columns', () => {
    const columns = getTableColumns(familias);

    expect(Object.keys(columns)).toEqual(['id', 'nome', 'dataCriacao']);
    expect(columns.id.notNull).toBe(true);
    expect(columns.nome.notNull).toBe(true);
    expect(columns.dataCriacao.notNull).toBe(true);
  });

  it('defines usuario_familia table with required columns', () => {
    const columns = getTableColumns(usuarioFamilia);

    expect(Object.keys(columns)).toEqual([
      'usuarioId',
      'familiaId',
      'role',
      'dataEntrada',
    ]);
    expect(columns.usuarioId.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.role.notNull).toBe(true);
    expect(columns.dataEntrada.notNull).toBe(true);
  });

  it('defines convites table with required columns', () => {
    const columns = getTableColumns(convites);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'codigo',
      'criadoPor',
      'expiraEm',
      'usadoPor',
      'usadoEm',
      'dataCriacao',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.codigo.notNull).toBe(true);
    expect(columns.criadoPor.notNull).toBe(true);
    expect(columns.expiraEm.notNull).toBe(true);
    expect(columns.dataCriacao.notNull).toBe(true);
  });

  it('defines solicitacoes_entrada table with required columns', () => {
    const columns = getTableColumns(solicitacoesEntrada);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'usuarioId',
      'status',
      'solicitadoEm',
      'respondidoEm',
      'respondidoPor',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.usuarioId.notNull).toBe(true);
    expect(columns.status.notNull).toBe(true);
    expect(columns.solicitadoEm.notNull).toBe(true);
  });

  it('defines categorias table with required columns', () => {
    const columns = getTableColumns(categorias);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'nome',
      'tipo',
      'ativo',
      'criadoPor',
      'criadoEm',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.nome.notNull).toBe(true);
    expect(columns.tipo.notNull).toBe(true);
    expect(columns.ativo.notNull).toBe(true);
    expect(columns.criadoPor.notNull).toBe(true);
    expect(columns.criadoEm.notNull).toBe(true);
  });

  it('defines categorias padrao for seed', () => {
    expect(CATEGORIAS_PADRAO_RECEITA).toEqual([
      'Salario',
      'Bonus',
      'Investimentos',
      'Outros',
    ]);
    expect(CATEGORIAS_PADRAO_DESPESA).toEqual([
      'Moradia',
      'Alimentacao',
      'Transporte',
      'Saude',
      'Lazer',
      'Educacao',
      'Assinaturas',
      'Compras',
      'Outros',
    ]);
  });
});
