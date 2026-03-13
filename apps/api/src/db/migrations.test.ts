import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('db migrations', () => {
  it('contains migration sql for core fase 1 schema', () => {
    const migrationsDir = resolve(process.cwd(), 'src/db/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const allSql = migrationFiles
      .map((file) => readFileSync(resolve(migrationsDir, file), 'utf8'))
      .join('\n');

    expect(allSql).toContain('CREATE TABLE "users"');
    expect(allSql).toContain('CREATE TABLE "familias"');
    expect(allSql).toContain('CREATE TABLE "usuario_familia"');
    expect(allSql).toContain('CREATE TABLE "convites"');
    expect(allSql).toContain('CREATE TABLE "solicitacoes_entrada"');
    expect(allSql).toContain('CREATE TABLE "categorias"');
    expect(allSql).toContain('CREATE TABLE "metodos_pagamento"');
    expect(allSql).toContain('CREATE TABLE "transacoes"');
    expect(allSql).toContain('CREATE TABLE "orcamento_categoria"');
    expect(allSql).toContain('CREATE TABLE "snapshots_mensais"');
    expect(allSql).toContain('CREATE INDEX "transacoes_familia_id_idx"');
    expect(allSql).toContain('CREATE INDEX "transacoes_mes_referencia_idx"');
    expect(allSql).toContain('CREATE INDEX "transacoes_usuario_registrou_id_idx"');
  });
});
