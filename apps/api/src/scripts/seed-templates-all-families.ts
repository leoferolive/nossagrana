/**
 * Script one-off: popula templates padrão para TODAS as famílias existentes
 * que ainda não têm templates.
 */
import { config } from 'dotenv';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import path from 'path';
import postgres from 'postgres';
import { fileURLToPath } from 'url';

import { categorias, familias, templatesTransacao, users, usuarioFamilia } from '../db/schema.js';
import { TEMPLATES_PADRAO } from '../db/seeds/templates-padrao.js';

config({
  path: path.resolve(
    import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)),
    '../../.env',
  ),
});

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida no .env');
  process.exit(1);
}

const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient);

async function main() {
  // Buscar todas as famílias ativas
  const allFamilias = await db
    .select({ id: familias.id, nome: familias.nome })
    .from(familias)
    .where(isNull(familias.deletedAt));

  console.log(`\n=== Seed Templates Padrão — Todas as Famílias ===\n`);
  console.log(`Famílias encontradas: ${allFamilias.length}`);

  for (const familia of allFamilias) {
    // Verificar se já tem templates
    const existing = await db
      .select({ id: templatesTransacao.id })
      .from(templatesTransacao)
      .where(and(eq(templatesTransacao.familiaId, familia.id), eq(templatesTransacao.ativo, true)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ✓ ${familia.nome} — já tem templates, pulando`);
      continue;
    }

    // Buscar um admin da família para criadoPor
    const [admin] = await db
      .select({ userId: usuarioFamilia.usuarioId })
      .from(usuarioFamilia)
      .where(and(eq(usuarioFamilia.familiaId, familia.id), eq(usuarioFamilia.role, 'admin')))
      .limit(1);

    if (!admin) {
      console.log(`  ✗ ${familia.nome} — sem admin, pulando`);
      continue;
    }

    // Buscar categorias da família
    const cats = await db
      .select({ id: categorias.id, nome: categorias.nome, tipo: categorias.tipo })
      .from(categorias)
      .where(and(eq(categorias.familiaId, familia.id), eq(categorias.ativo, true)));
    const catMap = new Map(cats.map((c) => [`${c.nome}:${c.tipo}`, c.id]));

    // Criar templates
    const values = TEMPLATES_PADRAO.map((t) => ({
      familiaId: familia.id,
      nome: t.nome,
      tipo: t.tipo as 'receita' | 'despesa',
      categoriaId: catMap.get(`${t.categoria}:${t.tipo}`) ?? null,
      ordem: t.ordem,
      criadoPor: admin.userId,
    }));

    await db.insert(templatesTransacao).values(values);
    console.log(`  ✓ ${familia.nome} — ${values.length} templates criados`);
  }

  console.log(`\nConcluído!`);
  await queryClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
