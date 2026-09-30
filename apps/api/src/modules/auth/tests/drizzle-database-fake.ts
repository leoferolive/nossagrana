import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface EscritaRegistrada {
  operacao: 'insert';
  valores?: Record<string, unknown>;
  conflito?: 'nothing' | 'update';
  atualizacao?: Record<string, unknown>;
}

/**
 * Fake nomeada do cliente Drizzle (postgres-js) só com a superfície usada por
 * `DrizzleRevokedTokenRepository`: registra inserts/upserts e devolve as linhas
 * configuradas em select/delete. O SQL real é coberto em `db/tests/*.pg.test.ts`.
 */
export class DrizzleDatabaseFake {
  readonly escritas: EscritaRegistrada[] = [];
  linhasSelect: unknown[] = [];
  linhasDelete: unknown[] = [];

  insert(): unknown {
    const escrita: EscritaRegistrada = { operacao: 'insert' };
    this.escritas.push(escrita);
    const builder = {
      values: (valores: Record<string, unknown>) => {
        escrita.valores = valores;
        return builder;
      },
      onConflictDoNothing: async () => {
        escrita.conflito = 'nothing';
      },
      onConflictDoUpdate: async (opcoes: { set: Record<string, unknown> }) => {
        escrita.conflito = 'update';
        escrita.atualizacao = opcoes.set;
      },
    };
    return builder;
  }

  select(): unknown {
    return { from: () => ({ where: () => ({ limit: async () => this.linhasSelect }) }) };
  }

  delete(): unknown {
    return { where: () => ({ returning: async () => this.linhasDelete }) };
  }

  comoDatabase(): PostgresJsDatabase {
    return this as unknown as PostgresJsDatabase;
  }
}
