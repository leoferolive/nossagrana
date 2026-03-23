import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  categorias,
  convites,
  familias,
  metodosPagamento,
  orcamentoCategoria,
  snapshotsMensais,
  solicitacoesEntrada,
  transacoes,
  users,
  usuarioFamilia,
} from './schema.js';
import { CATEGORIAS_PADRAO_DESPESA, CATEGORIAS_PADRAO_RECEITA } from './seeds/categorias-padrao.js';

describe('database schema', () => {
  it('defines users table with required columns', () => {
    const columns = getTableColumns(users);

    expect(Object.keys(columns)).toEqual(['id', 'nome', 'email', 'senhaHash', 'dataCriacao']);
    expect(columns.id.notNull).toBe(true);
    expect(columns.email.notNull).toBe(true);
    expect(columns.senhaHash.notNull).toBe(true);
    expect(columns.dataCriacao.notNull).toBe(true);
  });

  it('defines familias table with required columns', () => {
    const columns = getTableColumns(familias);

    expect(Object.keys(columns)).toEqual(['id', 'nome', 'dataCriacao', 'deletedAt']);
    expect(columns.id.notNull).toBe(true);
    expect(columns.nome.notNull).toBe(true);
    expect(columns.dataCriacao.notNull).toBe(true);
  });

  it('defines usuario_familia table with required columns', () => {
    const columns = getTableColumns(usuarioFamilia);

    expect(Object.keys(columns)).toEqual(['usuarioId', 'familiaId', 'role', 'dataEntrada']);
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
      'sistema',
      'criadoPor',
      'criadoEm',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.nome.notNull).toBe(true);
    expect(columns.tipo.notNull).toBe(true);
    expect(columns.ativo.notNull).toBe(true);
    expect(columns.sistema.notNull).toBe(true);
    expect(columns.criadoPor.notNull).toBe(true);
    expect(columns.criadoEm.notNull).toBe(true);
  });

  it('defines categorias padrao for seed', () => {
    expect(CATEGORIAS_PADRAO_RECEITA).toEqual(['Salario', 'Bonus', 'Investimentos', 'Outros']);
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

  it('defines metodos_pagamento table with required columns', () => {
    const columns = getTableColumns(metodosPagamento);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'nome',
      'tipo',
      'dataFechamento',
      'dataVencimento',
      'usuarioDonoId',
      'ativo',
      'criadoEm',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.nome.notNull).toBe(true);
    expect(columns.tipo.notNull).toBe(true);
    expect(columns.usuarioDonoId.notNull).toBe(true);
    expect(columns.ativo.notNull).toBe(true);
    expect(columns.criadoEm.notNull).toBe(true);
  });

  it('defines transacoes table with required columns', () => {
    const columns = getTableColumns(transacoes);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'tipo',
      'valor',
      'categoriaId',
      'descricao',
      'data',
      'mesReferencia',
      'metodoPagamentoId',
      'usuarioRegistrouId',
      'recorrente',
      'frequencia',
      'dataFimRecorrencia',
      'parcelado',
      'numeroParcelas',
      'parcelaAtual',
      'valorTotal',
      'valorParcela',
      'transacaoPaiId',
      'cofrinhoId',
      'criadoEm',
      'atualizadoEm',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.tipo.notNull).toBe(true);
    expect(columns.valor.notNull).toBe(true);
    expect(columns.categoriaId.notNull).toBe(true);
    expect(columns.data.notNull).toBe(true);
    expect(columns.mesReferencia.notNull).toBe(true);
    expect(columns.usuarioRegistrouId.notNull).toBe(true);
    expect(columns.recorrente.notNull).toBe(true);
    expect(columns.parcelado.notNull).toBe(true);
    expect(columns.criadoEm.notNull).toBe(true);
    expect(columns.atualizadoEm.notNull).toBe(true);
  });

  it('defines orcamento_categoria table with required columns', () => {
    const columns = getTableColumns(orcamentoCategoria);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'categoriaId',
      'valorLimite',
      'vigenciaInicio',
      'vigenciaFim',
      'criadoPor',
      'criadoEm',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.categoriaId.notNull).toBe(true);
    expect(columns.valorLimite.notNull).toBe(true);
    expect(columns.vigenciaInicio.notNull).toBe(true);
    expect(columns.criadoPor.notNull).toBe(true);
    expect(columns.criadoEm.notNull).toBe(true);
  });

  it('defines snapshots_mensais table with required columns', () => {
    const columns = getTableColumns(snapshotsMensais);

    expect(Object.keys(columns)).toEqual([
      'id',
      'familiaId',
      'mesReferencia',
      'totalReceitas',
      'totalDespesas',
      'saldo',
      'dadosCategorias',
      'dadosUsuarios',
      'divergente',
      'geradoEm',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.familiaId.notNull).toBe(true);
    expect(columns.mesReferencia.notNull).toBe(true);
    expect(columns.totalReceitas.notNull).toBe(true);
    expect(columns.totalDespesas.notNull).toBe(true);
    expect(columns.saldo.notNull).toBe(true);
    expect(columns.dadosCategorias.notNull).toBe(true);
    expect(columns.dadosUsuarios.notNull).toBe(true);
    expect(columns.divergente.notNull).toBe(true);
    expect(columns.geradoEm.notNull).toBe(true);
  });

  it('defines indexes for familia_id, mes_referencia and usuario_id in transacoes', () => {
    const indexes = getTableConfig(transacoes).indexes;
    const indexNames = indexes.map((indexConfig) => {
      const configWithName = indexConfig as { config?: { name?: string }; name?: string };
      return configWithName.config?.name ?? configWithName.name ?? '';
    });

    expect(indexNames).toEqual(
      expect.arrayContaining([
        'transacoes_familia_id_idx',
        'transacoes_mes_referencia_idx',
        'transacoes_usuario_registrou_id_idx',
      ]),
    );
  });
});
