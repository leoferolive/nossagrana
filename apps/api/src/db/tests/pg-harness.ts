import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Harness dos testes contra PostgreSQL real (issue #58). Cada teste cria um
 * banco descartável a partir de `PG_TEST_ADMIN_URL` (nunca um banco de
 * dev/produção) e aplica as migrations reais pelo migrator do Drizzle — o
 * mesmo caminho do `runMigrations` da API.
 */
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

interface JournalEntry {
  tag: string;
}

export interface BancoDescartavel {
  url: string;
  sql: postgres.Sql;
  descartar(): Promise<void>;
}

function adminUrl(): string {
  const url = process.env.PG_TEST_ADMIN_URL;
  if (!url) {
    throw new Error(
      'PG_TEST_ADMIN_URL ausente: esperado URL de um PostgreSQL descartável (ex.: bash scripts/test-pg.sh)',
    );
  }
  return url;
}

/** Conexão avulsa (ex.: segurar um lock concorrente no teste de lock_timeout). */
export function conectar(url: string): postgres.Sql {
  return postgres(url, { max: 1, onnotice: () => undefined });
}

export async function criarBancoDescartavel(): Promise<BancoDescartavel> {
  const nome = `ng_test_${randomUUID().replaceAll('-', '')}`;
  const admin = conectar(adminUrl());
  await admin.unsafe(`CREATE DATABASE ${nome}`);
  const url = new URL(adminUrl());
  url.pathname = `/${nome}`;
  const sql = conectar(url.toString());
  const descartar = async () => {
    await sql.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
    await admin.end();
  };
  return { url: url.toString(), sql, descartar };
}

/** Pasta temporária só com as migrations anteriores a `tag` (journal truncado). */
function pastaAte(tag: string): string {
  const pasta = mkdtempSync(path.join(tmpdir(), 'ng-migrations-'));
  cpSync(MIGRATIONS_DIR, pasta, { recursive: true });
  const journalPath = path.join(pasta, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: JournalEntry[] };
  const indice = journal.entries.findIndex((entry) => entry.tag === tag);
  if (indice < 0) throw new Error(`Migration "${tag}" não existe no journal`);
  journal.entries = journal.entries.slice(0, indice);
  writeFileSync(journalPath, JSON.stringify(journal));
  return pasta;
}

async function migrarPasta(url: string, migrationsFolder: string): Promise<void> {
  const client = conectar(url);
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}

/** Aplica todas as migrations reais do repositório. */
export function aplicarMigrations(url: string): Promise<void> {
  return migrarPasta(url, MIGRATIONS_DIR);
}

/** Aplica só as migrations anteriores a `tag`, para semear dados legados antes dela. */
export async function aplicarMigrationsAntesDe(url: string, tag: string): Promise<void> {
  const pasta = pastaAte(tag);
  try {
    await migrarPasta(url, pasta);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}
