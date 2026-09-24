import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';

import type { ExecutorDrizzle } from '../executor.types.js';

export interface ConsultaCapturada {
  sql: string;
  params: unknown[];
}

type Linhas = unknown[][];

/**
 * Fake nomeada do cliente postgres-js: o Drizzle REAL monta o SQL e chama
 * `unsafe(query, params)`; aqui a consulta é capturada e respondida com linhas
 * enfileiradas (`responderCom`) — sem banco. Permite afirmar, em teste
 * unitário, o SQL que o adapter gera (filtro por familia_id, UPDATE
 * condicional, FOR UPDATE, lock_timeout). O comportamento sob concorrência
 * real fica nos testes *.pg.test.ts.
 */
export class ClientePostgresFake {
  readonly options = { parsers: {}, serializers: {} };
  readonly consultas: ConsultaCapturada[] = [];
  private readonly respostas: Linhas[] = [];
  private falhaPendente: Error | null = null;

  /** Próxima consulta que devolve linhas recebe estes objetos (na ordem das colunas selecionadas). */
  responderCom(...linhas: object[]): this {
    this.respostas.push(linhas.map((linha) => Object.values(linha)));
    return this;
  }

  falharNaProxima(erro: Error): this {
    this.falhaPendente = erro;
    return this;
  }

  unsafe(query: string, params: unknown[] = []) {
    this.consultas.push({ sql: query, params });
    const falha = this.consumirFalha();
    return {
      values: () => (falha ? Promise.reject(falha) : Promise.resolve(this.respostas.shift() ?? [])),
      then: (ok: (valor: unknown) => unknown, erro?: (motivo: unknown) => unknown) =>
        (falha ? Promise.reject(falha) : Promise.resolve([])).then(ok, erro),
    };
  }

  /** `db.transaction` do Drizzle chama `client.begin`: o mesmo fake faz as vezes do tx. */
  begin<T>(trabalho: (cliente: ClientePostgresFake) => Promise<T>): Promise<T> {
    return trabalho(this);
  }

  executor(): ExecutorDrizzle {
    return drizzle(this as unknown as postgres.Sql);
  }

  private consumirFalha(): Error | null {
    const falha = this.falhaPendente;
    this.falhaPendente = null;
    return falha;
  }
}
