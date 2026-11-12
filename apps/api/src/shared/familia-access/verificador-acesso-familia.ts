import { db } from '../../db/client.js';
import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { type AcessoFamilia, verificarAcessoFamilia } from './familia-access.repository.js';

/**
 * Contrato de "este usuário pode agir nesta família?", compartilhado por HTTP
 * (`requireFamiliaScope`) e WebSocket. Injetável para que testes de rota exercitem a
 * posse de verdade com uma fake nomeada, sem qualquer branch por NODE_ENV (#79).
 */
export interface VerificadorAcessoFamilia {
  verificar(usuarioId: string, familiaId: string): Promise<AcessoFamilia>;
}

/** Implementação de produção: consulta `usuario_familia` + `familias` no PostgreSQL. */
export class DrizzleVerificadorAcessoFamilia implements VerificadorAcessoFamilia {
  /** Padrão: `db` da app; a fixture pg injeta a conexão do cenário. */
  constructor(private readonly database: ExecutorDrizzle = db) {}

  async verificar(usuarioId: string, familiaId: string): Promise<AcessoFamilia> {
    return verificarAcessoFamilia(this.database, usuarioId, familiaId);
  }
}
