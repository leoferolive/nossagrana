import { describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { ConflitoDeConcorrenciaError } from '../../shared/unit-of-work/conflito-concorrencia.js';
import { DrizzleTransacaoRepository } from '../transacao/transacao.repository.js';
import { criarBuscaCategoriaCofrinho } from './cofrinho.categoria.js';
import { DrizzleMovimentacaoCofrinhoRepository } from './cofrinho.movimentacao.repository.js';
import { DrizzleCofrinhoRepository } from './cofrinho.repository.js';
import {
  criarRepositoriosCofrinhoDrizzle,
  criarUnitOfWorkCofrinhoDrizzle,
} from './cofrinho.unit-of-work.js';

/** Mesma ordem das colunas selecionadas (`colunasMovimentacao`). */
const linhaMovimentacao = {
  id: 'm1',
  cofrinhoId: 'c1',
  familiaId: 'fA',
  tipo: 'aporte',
  valor: '10.00',
  descricao: null,
  transacaoId: 't1',
  registradoPor: 'u1',
  registradoEm: new Date('2026-09-01T00:00:00Z'),
  mesReferencia: '2026-09',
};

/** Erro do driver com SQLSTATE, como o postgres-js entrega. */
class ErroPostgresFake extends Error {
  constructor(readonly code: string) {
    super(`erro ${code}`);
  }
}

describe('DrizzleMovimentacaoCofrinhoRepository (SQL gerado)', () => {
  it('create grava no ledger e listByCofrinho filtra cofrinho + família', async () => {
    const cliente = new ClientePostgresFake()
      .responderCom(linhaMovimentacao)
      .responderCom(linhaMovimentacao);
    const repo = new DrizzleMovimentacaoCofrinhoRepository(cliente.executor());
    const busca = { cofrinhoId: 'c1', familiaId: 'fA' };

    const criada = await repo.create({
      ...busca,
      tipo: 'aporte',
      valor: '10.00',
      registradoPor: 'u1',
      mesReferencia: '2026-09',
    });
    const lista = await repo.listByCofrinho(busca);

    expect(criada).toMatchObject({ id: 'm1', transacaoId: 't1' });
    expect(cliente.consultas[0]?.sql).toMatch(/^insert into "movimentacoes_cofrinho"/);
    expect(cliente.consultas[1]?.sql).toMatch(
      /where \("movimentacoes_cofrinho"\."cofrinho_id" = \$1 and "movimentacoes_cofrinho"\."familia_id" = \$2\) order by/,
    );
    expect(lista).toHaveLength(1);
  });
});

describe('criarBuscaCategoriaCofrinho', () => {
  it('busca a categoria de sistema "Cofrinho" da família', async () => {
    const cliente = new ClientePostgresFake().responderCom({ id: 'cat-cofrinho' });

    expect(await criarBuscaCategoriaCofrinho(cliente.executor())('fA')).toEqual({
      id: 'cat-cofrinho',
    });
    expect(cliente.consultas[0]?.params).toEqual(['fA', 'Cofrinho', true]);
  });

  it('família sem a categoria de sistema falha citando a família e o esperado', async () => {
    const busca = criarBuscaCategoriaCofrinho(new ClientePostgresFake().executor());

    await expect(busca('fA')).rejects.toThrow(
      /família fA: esperado categoria de sistema "Cofrinho"/,
    );
  });
});

describe('fábricas de Unit of Work do cofrinho (produção)', () => {
  it('repositórios do cofrinho, ledger e transação sobre o mesmo executor', () => {
    const repos = criarRepositoriosCofrinhoDrizzle(new ClientePostgresFake().executor());

    expect(repos.cofrinhos).toBeInstanceOf(DrizzleCofrinhoRepository);
    expect(repos.movimentacoes).toBeInstanceOf(DrizzleMovimentacaoCofrinhoRepository);
    expect(repos.transacoes).toBeInstanceOf(DrizzleTransacaoRepository);
  });

  it('abre transação, usa a espera configurada e traduz lock timeout em conflito de domínio', async () => {
    const cliente = new ClientePostgresFake();
    const uow = criarUnitOfWorkCofrinhoDrizzle(cliente.executor(), 250);

    const erro = await uow
      .executar(async ({ repos }) => {
        cliente.falharNaProxima(new ErroPostgresFake('55P03'));
        return repos.cofrinhos.incrementarSaldo({ id: 'c1', familiaId: 'fA', valor: '1.00' });
      })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ConflitoDeConcorrenciaError);
    expect(cliente.consultas[0]?.sql).toBe('SET LOCAL lock_timeout = 250');
  });
});
