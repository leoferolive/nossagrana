import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { UnitOfWorkComConflitoTraduzido } from '../../shared/unit-of-work/conflito-concorrencia.js';
import { DrizzleUnitOfWork } from '../../shared/unit-of-work/drizzle-unit-of-work.js';
import { InMemoryUnitOfWork } from '../../shared/unit-of-work/in-memory-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.types.js';
import {
  DrizzleTransacaoRepository,
  type InMemoryTransacaoRepository,
} from '../transacao/transacao.repository.js';
import type { InMemoryCofrinhoRepository } from './cofrinho.in-memory-repository.js';
import {
  DrizzleMovimentacaoCofrinhoRepository,
  type InMemoryMovimentacaoCofrinhoRepository,
} from './cofrinho.movimentacao.repository.js';
import { DrizzleCofrinhoRepository } from './cofrinho.repository.js';
import type { CofrinhoRepositorios } from './cofrinho.types.js';

/**
 * Cofrinho, ledger e transação sobre o MESMO executor (o `db` ou o `tx` da
 * unidade). `esperaMaximaPorLockMs` omitido = padrão de produção (5s).
 */
export function criarRepositoriosCofrinhoDrizzle(
  executor: ExecutorDrizzle,
  esperaMaximaPorLockMs?: number,
): CofrinhoRepositorios {
  return {
    cofrinhos: new DrizzleCofrinhoRepository(executor, esperaMaximaPorLockMs),
    movimentacoes: new DrizzleMovimentacaoCofrinhoRepository(executor),
    transacoes: new DrizzleTransacaoRepository(executor),
  };
}

/**
 * Produção: uma operação de cofrinho = um `db.transaction`; lock timeout e
 * deadlock chegam ao service como `ConflitoDeConcorrenciaError` (409).
 */
export function criarUnitOfWorkCofrinhoDrizzle(
  db: ExecutorDrizzle,
  esperaMaximaPorLockMs?: number,
): UnitOfWork<CofrinhoRepositorios> {
  return new UnitOfWorkComConflitoTraduzido(
    new DrizzleUnitOfWork(db, (tx: ExecutorDrizzle) =>
      criarRepositoriosCofrinhoDrizzle(tx, esperaMaximaPorLockMs),
    ),
  );
}

interface ParticipantesCofrinhoInMemory {
  cofrinhos: InMemoryCofrinhoRepository;
  movimentacoes: InMemoryMovimentacaoCofrinhoRepository;
  transacoes: InMemoryTransacaoRepository;
}

/** Testes e NODE_ENV=test: staging dos três repositórios, publicado só no commit. */
export function criarUnitOfWorkCofrinhoInMemory(
  participantes: ParticipantesCofrinhoInMemory,
): InMemoryUnitOfWork<CofrinhoRepositorios> {
  return new InMemoryUnitOfWork<CofrinhoRepositorios>(participantes);
}
