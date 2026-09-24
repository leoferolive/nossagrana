import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';

import { criarBuscaCategoriaCofrinho } from '../../modules/cofrinho/cofrinho.categoria.js';
import { UnitOfWorkInstrumentada } from '../../modules/cofrinho/cofrinho.fakes.js';
import { CofrinhoService } from '../../modules/cofrinho/cofrinho.service.js';
import {
  criarRepositoriosCofrinhoDrizzle,
  criarUnitOfWorkCofrinhoDrizzle,
} from '../../modules/cofrinho/cofrinho.unit-of-work.js';
import type { FamiliaSemeada } from './pg-fixtures.js';

/**
 * Harness dos testes PostgreSQL de cofrinho (#63): cada "cliente" é uma
 * conexão própria (pool de 1) com o wiring de PRODUÇÃO (DrizzleUnitOfWork +
 * tradução de conflitos), instrumentado para pausar/falhar após uma escrita.
 */
export interface ClienteCofrinho {
  service: CofrinhoService;
  instrumentada: UnitOfWorkInstrumentada;
}

export function clienteCofrinho(
  conexao: postgres.Sql,
  esperaMaximaPorLockMs?: number,
): ClienteCofrinho {
  const db = drizzle(conexao);
  const instrumentada = new UnitOfWorkInstrumentada(
    criarUnitOfWorkCofrinhoDrizzle(db, esperaMaximaPorLockMs),
  );
  const service = new CofrinhoService(
    criarRepositoriosCofrinhoDrizzle(db),
    instrumentada,
    criarBuscaCategoriaCofrinho(db),
  );
  return { service, instrumentada };
}

/** Categoria de sistema "Cofrinho" que a API cria para cada família. */
export async function semearCategoriaCofrinho(sql: postgres.Sql, f: FamiliaSemeada): Promise<void> {
  await sql`INSERT INTO categorias (familia_id, nome, tipo, criado_por, sistema)
    VALUES (${f.familiaId}, 'Cofrinho', 'despesa', ${f.usuarioId}, true)`;
}

interface EstadoCofrinho {
  saldo: string;
  status: string;
  aportes: number;
  retiradas: number;
  transacoes: number;
  saldoLedger: string;
}

/** Lido por OUTRA conexão: só enxerga o que foi de fato commitado. */
export async function estadoCofrinho(
  sql: postgres.Sql,
  cofrinhoId: string,
): Promise<EstadoCofrinho> {
  const [linha] = await sql`
    SELECT c.saldo_atual::text AS saldo, c.status::text AS status,
      (SELECT count(*)::int FROM movimentacoes_cofrinho m WHERE m.cofrinho_id = c.id AND m.tipo = 'aporte') AS aportes,
      (SELECT count(*)::int FROM movimentacoes_cofrinho m WHERE m.cofrinho_id = c.id AND m.tipo = 'retirada') AS retiradas,
      (SELECT count(*)::int FROM transacoes t WHERE t.cofrinho_id = c.id) AS transacoes,
      (SELECT coalesce(sum(CASE WHEN m.tipo = 'aporte' THEN m.valor ELSE -m.valor END), 0)::numeric(12,2)::text
         FROM movimentacoes_cofrinho m WHERE m.cofrinho_id = c.id AND m.familia_id = c.familia_id) AS "saldoLedger"
    FROM cofrinhos c WHERE c.id = ${cofrinhoId}`;
  if (!linha) throw new Error(`Cofrinho ${cofrinhoId} não existe: esperado ID semeado no teste`);
  return linha as unknown as EstadoCofrinho;
}

const DIAGNOSTICO_RECONCILIACAO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../diagnostics/reconciliacao-cofrinhos.sql',
);

interface ResultadoDiagnostico {
  total_cofrinhos: number;
  divergentes: number;
  saldo_negativo: number;
}

/** Roda o arquivo de diagnóstico REAL (o mesmo do runbook de produção). */
export async function diagnosticoReconciliacao(sql: postgres.Sql): Promise<ResultadoDiagnostico> {
  const resultados = await sql.unsafe(readFileSync(DIAGNOSTICO_RECONCILIACAO, 'utf8')).simple();
  const select = (resultados as unknown as postgres.Row[][]).find(
    (r) => Array.isArray(r) && r.length > 0,
  );
  const [linha] = select ?? [];
  if (!linha) throw new Error('Diagnóstico não devolveu linha: esperado 1 linha de contagens');
  return {
    total_cofrinhos: Number(linha.total_cofrinhos),
    divergentes: Number(linha.divergentes),
    saldo_negativo: Number(linha.saldo_negativo),
  };
}

/** Transações abertas esperando lock de linha (a 2ª operação concorrente bloqueada). */
export async function esperandoLock(sql: postgres.Sql): Promise<number> {
  const [linha] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity
    WHERE datname = current_database() AND wait_event_type = 'Lock'`;
  return linha?.n as number;
}

export async function transacoesPendentes(sql: postgres.Sql): Promise<number> {
  const [linha] = await sql`SELECT count(*)::int AS n FROM pg_stat_activity
    WHERE datname = current_database() AND state LIKE 'idle in transaction%'`;
  return linha?.n as number;
}
