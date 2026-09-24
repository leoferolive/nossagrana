import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

/**
 * O `db` da app ou o `tx` recebido em `db.transaction` (#78): repositórios
 * Drizzle recebem um dos dois pelo construtor, então o mesmo código grava
 * dentro ou fora de uma Unit of Work.
 */
export type ExecutorDrizzle = PgDatabase<PostgresJsQueryResultHKT, Record<string, never>>;
