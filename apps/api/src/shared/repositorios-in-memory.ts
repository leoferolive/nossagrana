import type { FastifyInstance } from 'fastify';

import { env } from '../config/env.js';

import { InMemoryCategoriaRepository } from '../modules/categoria/categoria.repository.js';
import { InMemoryCofrinhoRepository } from '../modules/cofrinho/cofrinho.in-memory-repository.js';
import { InMemoryMovimentacaoCofrinhoRepository } from '../modules/cofrinho/cofrinho.movimentacao.repository.js';
import { InMemoryMetodoPagamentoRepository } from '../modules/metodo-pagamento/metodo-pagamento.repository.js';
import { InMemoryTransacaoRepository } from '../modules/transacao/transacao.repository.js';
import { ModulosReferenciaOwnershipRepository } from './referencia-ownership/referencia-ownership.repository.js';
import { ReferenciaOwnershipValidator } from './referencia-ownership/referencia-ownership.validator.js';

/**
 * Repositórios InMemory compartilhados entre os módulos de UMA instância da app
 * em NODE_ENV=test. Sem isso cada rota tinha o próprio InMemory e uma categoria
 * criada via POST /categorias não existia para POST /transacoes.
 */
export interface RepositoriosInMemoryCompartilhados {
  categorias: InMemoryCategoriaRepository;
  metodosPagamento: InMemoryMetodoPagamentoRepository;
  cofrinhos: InMemoryCofrinhoRepository;
  /** Ledger dos cofrinhos, publicado pela `InMemoryUnitOfWork` das rotas de cofrinho/templates (#59). */
  movimentacoesCofrinho: InMemoryMovimentacaoCofrinhoRepository;
  /** Base publicada pela `InMemoryUnitOfWork` das rotas de transação (#78). */
  transacoes: InMemoryTransacaoRepository;
}

declare module 'fastify' {
  interface FastifyInstance {
    repositoriosInMemory?: RepositoriosInMemoryCompartilhados;
  }
}

export function criarRepositoriosInMemoryCompartilhados(): RepositoriosInMemoryCompartilhados {
  return {
    categorias: new InMemoryCategoriaRepository(),
    metodosPagamento: new InMemoryMetodoPagamentoRepository(),
    cofrinhos: new InMemoryCofrinhoRepository(),
    movimentacoesCofrinho: new InMemoryMovimentacaoCofrinhoRepository(),
    transacoes: new InMemoryTransacaoRepository(),
  };
}

/** Em NODE_ENV=test, as rotas desta instância da app compartilham os mesmos repositórios. */
export function decorarRepositoriosInMemoryDeTeste(app: FastifyInstance): void {
  if (env.NODE_ENV !== 'test') return;
  app.decorate('repositoriosInMemory', criarRepositoriosInMemoryCompartilhados());
}

/** Plugin registrado isoladamente (sem buildApp) recebe um conjunto próprio. */
export function repositoriosInMemoryDe(
  fastify: FastifyInstance,
): RepositoriosInMemoryCompartilhados {
  return fastify.repositoriosInMemory ?? criarRepositoriosInMemoryCompartilhados();
}

export function validadorReferenciasInMemory(
  repositorios: RepositoriosInMemoryCompartilhados,
): ReferenciaOwnershipValidator {
  return new ReferenciaOwnershipValidator(new ModulosReferenciaOwnershipRepository(repositorios));
}
