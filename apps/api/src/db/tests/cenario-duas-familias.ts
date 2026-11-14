import { randomUUID } from 'node:crypto';

import type postgres from 'postgres';

import type { UsuarioDeTeste } from './credenciais-teste.js';
import { inserirId, semearCategoriaEMetodo } from './pg-fixtures.js';
import { aplicarMigrations, criarBancoDescartavel, type BancoDescartavel } from './pg-harness.js';

/** Uma família do cenário, com todos os IDs retornados explicitamente. */
export interface FamiliaDoCenario {
  familiaId: string;
  admin: UsuarioDeTeste;
  membro: UsuarioDeTeste;
  categoriaId: string;
  metodoPagamentoId: string;
  /** Duas transações (despesa e receita) registradas pelo admin. */
  transacaoIds: string[];
}

export interface CenarioDuasFamilias {
  banco: BancoDescartavel;
  familiaA: FamiliaDoCenario;
  familiaB: FamiliaDoCenario;
  descartar(): Promise<void>;
}

interface OpcoesDoCenario {
  /** Substitui o migrator real (usado para simular falha de migration). */
  migrar?: (url: string) => Promise<void>;
}

async function inserirUsuario(sql: postgres.Sql, nome: string): Promise<UsuarioDeTeste> {
  // O sufixo único evita colisão de e-mail caso dois cenários dividam um banco.
  const email = `${nome.toLowerCase()}-${randomUUID()}@example.test`;
  const id = await inserirId(
    sql`INSERT INTO users (nome, email, senha_hash)
        VALUES (${nome}, ${email}, 'hash-ficticio-nao-e-credencial') RETURNING id`,
  );
  return { id, email };
}

async function inserirTransacao(
  sql: postgres.Sql,
  f: Pick<FamiliaDoCenario, 'familiaId' | 'categoriaId' | 'metodoPagamentoId'>,
  registradoPor: string,
  tipo: 'despesa' | 'receita',
): Promise<string> {
  return inserirId(
    sql`INSERT INTO transacoes (familia_id, tipo, valor, categoria_id, data, mes_referencia,
          metodo_pagamento_id, usuario_registrou_id)
        VALUES (${f.familiaId}, ${tipo}, '10.00', ${f.categoriaId}, '2026-09-01', '2026-09',
          ${f.metodoPagamentoId}, ${registradoPor}) RETURNING id`,
  );
}

async function semearFamiliaDoCenario(sql: postgres.Sql, nome: string): Promise<FamiliaDoCenario> {
  const admin = await inserirUsuario(sql, `Admin${nome}`);
  const membro = await inserirUsuario(sql, `Membro${nome}`);
  const familiaId = await inserirId(sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`);
  await sql`INSERT INTO usuario_familia (usuario_id, familia_id, role)
    VALUES (${admin.id}, ${familiaId}, 'admin'), (${membro.id}, ${familiaId}, 'membro')`;
  const cadastros = await semearCategoriaEMetodo(sql, familiaId, admin.id);
  const base = { familiaId, ...cadastros };
  const transacaoIds = [
    await inserirTransacao(sql, base, admin.id, 'despesa'),
    await inserirTransacao(sql, base, admin.id, 'receita'),
  ];
  return { ...base, admin, membro, transacaoIds };
}

async function migrarOuFalhar(
  banco: BancoDescartavel,
  migrar: (url: string) => Promise<void>,
): Promise<void> {
  try {
    await migrar(banco.url);
  } catch (erro) {
    const nome = new URL(banco.url).pathname.slice(1);
    // Preserva o erro original da migration mesmo se o descarte falhar.
    await banco.descartar().catch(() => undefined);
    const causa = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`Falha ao aplicar migrations no banco de teste ${nome}: ${causa}`);
  }
}

/**
 * Cria um banco descartável migrado com duas famílias independentes (A e B),
 * cada uma com admin, membro, categoria, método de pagamento e transações.
 * Chame `descartar()` no teardown. Um banco por cenário garante isolamento e
 * execução paralela sem colisão.
 *
 * @example const { banco, familiaA, familiaB, descartar } = await criarCenarioDuasFamilias();
 */
export async function criarCenarioDuasFamilias(
  opcoes: OpcoesDoCenario = {},
): Promise<CenarioDuasFamilias> {
  const banco = await criarBancoDescartavel();
  await migrarOuFalhar(banco, opcoes.migrar ?? aplicarMigrations);
  try {
    const familiaA = await semearFamiliaDoCenario(banco.sql, 'A');
    const familiaB = await semearFamiliaDoCenario(banco.sql, 'B');
    return { banco, familiaA, familiaB, descartar: () => banco.descartar() };
  } catch (erro) {
    await banco.descartar().catch(() => undefined);
    throw erro;
  }
}
