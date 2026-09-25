import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { DrizzleIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';
import { DrizzleUnitOfWork } from '../../shared/unit-of-work/drizzle-unit-of-work.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.types.js';
import { DrizzleTransacaoRepository } from './transacao.repository.js';
import type { TransacaoRepositorios } from './transacao.types.js';

/** Transações e chave de idempotência sobre o MESMO executor (o `tx` da unidade, #90). */
export function criarRepositoriosTransacaoDrizzle(
  executor: ExecutorDrizzle,
): TransacaoRepositorios {
  return {
    transacoes: new DrizzleTransacaoRepository(executor),
    idempotencia: new DrizzleIdempotenciaRepository(executor),
  };
}

/** Produção: registro composto (pai + filhas + chave) num único `db.transaction` (#78/#85/#90). */
export function criarUnitOfWorkTransacaoDrizzle(
  db: ExecutorDrizzle,
): UnitOfWork<TransacaoRepositorios> {
  return new DrizzleUnitOfWork(db, criarRepositoriosTransacaoDrizzle);
}
