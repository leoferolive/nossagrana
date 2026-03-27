import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

import { categorias, cofrinhos, templatesTransacao, users } from '../db/schema.js';

config({ path: path.resolve(import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida no .env');
  process.exit(1);
}

const familiaId = process.argv[2] ?? process.env.FAMILIA_ID;
if (!familiaId) {
  console.error('familiaId não fornecido. Use: tsx seed-templates.ts <familiaId>');
  console.error('Ou defina a variável de ambiente FAMILIA_ID.');
  process.exit(1);
}

const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient);

type TemplateCategoria = {
  tipo: 'categoria';
  nome: string;
  categoriaNome: string;
};

type TemplateCofrinho = {
  tipo: 'cofrinho';
  nome: string;
  cofrinhoNome: string;
};

type TemplateDefinicao = (TemplateCategoria | TemplateCofrinho) & {
  ordem: number;
  transacaoTipo: 'receita' | 'despesa';
};

const TEMPLATES: TemplateDefinicao[] = [
  // Receitas
  { ordem: 0, nome: 'Salário Leo', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Salario' },
  { ordem: 1, nome: 'Salário Beta', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Salario' },
  { ordem: 2, nome: '13º Leo', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Outros' },
  { ordem: 3, nome: '13º Beta', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Outros' },
  { ordem: 4, nome: 'Férias Leo', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Outros' },
  { ordem: 5, nome: 'Férias Beta', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Outros' },
  { ordem: 6, nome: 'Outros Receitas', transacaoTipo: 'receita', tipo: 'categoria', categoriaNome: 'Outros' },

  // Despesas — Moradia
  { ordem: 7, nome: 'Luz', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 8, nome: 'Gás', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 9, nome: 'Internet', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 10, nome: 'YouTube Premium', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Assinaturas' },
  { ordem: 11, nome: 'Supermercado/Alimentação', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Alimentacao' },
  { ordem: 12, nome: 'Casa', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 13, nome: 'IPTU', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 14, nome: 'Seguro Residencial', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 15, nome: 'Condomínio', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },
  { ordem: 16, nome: 'Financiamento Imóvel', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Moradia' },

  // Despesas — Saúde
  { ordem: 17, nome: 'Seguro de Vida Leo', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Saude' },
  { ordem: 18, nome: 'Consulta/Exames', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Saude' },
  { ordem: 19, nome: 'Vacina', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Saude' },
  { ordem: 20, nome: 'Plano Dental', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Saude' },
  { ordem: 21, nome: 'Medicamentos', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Saude' },

  // Despesas — Transporte
  { ordem: 22, nome: 'Financiamento Carro', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 23, nome: 'Seguro Auto', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 24, nome: 'Combustível', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 25, nome: 'Revisão', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 26, nome: 'IPVA', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 27, nome: 'Veloe', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 28, nome: 'Uber', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 29, nome: 'Lavagem', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },
  { ordem: 30, nome: 'Estacionamento', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Transporte' },

  // Despesas — Cofrinhos
  { ordem: 31, nome: 'Fundo de Emergência', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'Fundo de Emergência' },
  { ordem: 32, nome: 'Aposentadoria', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'Aposentadoria' },
  { ordem: 33, nome: 'Viagens', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'Viagens' },
  { ordem: 34, nome: 'Carro', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'Carro' },
  { ordem: 35, nome: 'Flor', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'Flor' },
  { ordem: 36, nome: 'AP', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'AP' },
  { ordem: 37, nome: 'Poliana', transacaoTipo: 'despesa', tipo: 'cofrinho', cofrinhoNome: 'Poliana' },

  // Despesas — Pessoais
  { ordem: 38, nome: 'Celular Beta', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Assinaturas' },
  { ordem: 39, nome: 'Celular Leo', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Assinaturas' },
  { ordem: 40, nome: 'Mensal Leo', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Compras' },
  { ordem: 41, nome: 'Mensal Beta', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Compras' },
  { ordem: 42, nome: 'Mensal Poli', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Compras' },
  { ordem: 43, nome: 'Passeios', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Lazer' },
  { ordem: 44, nome: 'Plano Livelo', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Assinaturas' },
  { ordem: 45, nome: 'ABACUS', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Assinaturas' },
  { ordem: 46, nome: 'Clube Smiles', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Assinaturas' },
  { ordem: 47, nome: 'Academia', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Saude' },
  { ordem: 48, nome: 'Natação Poli', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Educacao' },
  { ordem: 49, nome: 'Creche', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Educacao' },
  { ordem: 50, nome: 'Outros Despesas', transacaoTipo: 'despesa', tipo: 'categoria', categoriaNome: 'Outros' },
];

const COFRINHOS_NOMES = [
  'Fundo de Emergência',
  'Aposentadoria',
  'Viagens',
  'Carro',
  'Flor',
  'AP',
  'Poliana',
] as const;

async function main() {
  console.log('=== Seed — 51 Templates de Transação ===\n');
  console.log(`familiaId: ${familiaId}`);

  // 1. Buscar um usuário da família para criadoPor
  const usuariosFamilia = await db
    .select({ id: users.id, nome: users.nome })
    .from(users)
    .limit(1);

  if (usuariosFamilia.length === 0) {
    console.error('Nenhum usuário encontrado no banco. Crie um usuário primeiro.');
    process.exit(1);
  }

  const usuario = usuariosFamilia[0];
  console.log(`Usuário para criadoPor: ${usuario.nome} (${usuario.id})`);

  // 2. Buscar categorias da família
  const categoriasDaFamilia = await db
    .select()
    .from(categorias)
    .where(eq(categorias.familiaId, familiaId));

  if (categoriasDaFamilia.length === 0) {
    console.error(`Nenhuma categoria encontrada para familiaId=${familiaId}.`);
    console.error('Garanta que as categorias padrão foram criadas para essa família.');
    process.exit(1);
  }

  // Mapa: categoriaNome + tipo -> categoriaId
  const categoriaMap = new Map<string, string>();
  for (const cat of categoriasDaFamilia) {
    const key = `${cat.nome}:${cat.tipo}`;
    categoriaMap.set(key, cat.id);
  }
  console.log(`${categoriasDaFamilia.length} categorias carregadas`);

  // 3. Garantir que os cofrinhos existem (criar se necessário)
  const cofrinhoMap = new Map<string, string>();

  const cofrinhosDaFamilia = await db
    .select()
    .from(cofrinhos)
    .where(eq(cofrinhos.familiaId, familiaId));

  for (const c of cofrinhosDaFamilia) {
    cofrinhoMap.set(c.nome, c.id);
  }

  let cofrinhosCreated = 0;
  for (const nome of COFRINHOS_NOMES) {
    if (!cofrinhoMap.has(nome)) {
      const [criado] = await db
        .insert(cofrinhos)
        .values({
          familiaId,
          nome,
          status: 'ativo',
          criadoPor: usuario.id,
        })
        .returning();
      cofrinhoMap.set(nome, criado.id);
      cofrinhosCreated++;
      console.log(`  Cofrinho criado: "${nome}" (${criado.id})`);
    }
  }

  if (cofrinhosCreated === 0) {
    console.log(`Todos os ${COFRINHOS_NOMES.length} cofrinhos já existem`);
  } else {
    console.log(`${cofrinhosCreated} cofrinho(s) criado(s)`);
  }

  // 4. Montar lista de templates para inserção
  type TemplateInsert = {
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
    categoriaId: string | null;
    cofrinhoId: string | null;
    ordem: number;
    criadoPor: string;
  };

  const templatesParaInserir: TemplateInsert[] = [];
  const erros: string[] = [];

  for (const def of TEMPLATES) {
    if (def.tipo === 'categoria') {
      const key = `${def.categoriaNome}:${def.transacaoTipo}`;
      const categoriaId = categoriaMap.get(key);

      if (!categoriaId) {
        erros.push(
          `[ordem ${def.ordem}] Categoria "${def.categoriaNome}" (${def.transacaoTipo}) não encontrada`,
        );
        continue;
      }

      templatesParaInserir.push({
        familiaId,
        nome: def.nome,
        tipo: def.transacaoTipo,
        categoriaId,
        cofrinhoId: null,
        ordem: def.ordem,
        criadoPor: usuario.id,
      });
    } else {
      const cofrinhoId = cofrinhoMap.get(def.cofrinhoNome);

      if (!cofrinhoId) {
        erros.push(`[ordem ${def.ordem}] Cofrinho "${def.cofrinhoNome}" não encontrado`);
        continue;
      }

      templatesParaInserir.push({
        familiaId,
        nome: def.nome,
        tipo: def.transacaoTipo,
        categoriaId: null,
        cofrinhoId,
        ordem: def.ordem,
        criadoPor: usuario.id,
      });
    }
  }

  if (erros.length > 0) {
    console.warn('\nAvisos (templates ignorados por dados ausentes):');
    for (const e of erros) {
      console.warn(`  - ${e}`);
    }
  }

  console.log(`\n${templatesParaInserir.length} templates prontos para inserção`);

  // 5. Verificar templates já existentes para evitar duplicatas (pelo unique index)
  const existentes = await db
    .select({ nome: templatesTransacao.nome, tipo: templatesTransacao.tipo })
    .from(templatesTransacao)
    .where(
      and(
        eq(templatesTransacao.familiaId, familiaId),
        eq(templatesTransacao.ativo, true),
      ),
    );

  const existentesSet = new Set(existentes.map((t) => `${t.nome}:${t.tipo}`));
  const novos = templatesParaInserir.filter(
    (t) => !existentesSet.has(`${t.nome}:${t.tipo}`),
  );
  const duplicatas = templatesParaInserir.length - novos.length;

  if (duplicatas > 0) {
    console.log(`${duplicatas} template(s) já existem e serão ignorados`);
  }

  // 6. Inserir templates em batch
  if (novos.length > 0) {
    await db.insert(templatesTransacao).values(novos);
    console.log(`${novos.length} templates inseridos com sucesso`);
  } else {
    console.log('Nenhum template novo para inserir');
  }

  // 7. Resumo
  const receitas = novos.filter((t) => t.tipo === 'receita');
  const despesas = novos.filter((t) => t.tipo === 'despesa');
  const comCategoria = novos.filter((t) => t.categoriaId !== null);
  const comCofrinho = novos.filter((t) => t.cofrinhoId !== null);

  console.log('\n=== Resumo ===');
  console.log(`familiaId: ${familiaId}`);
  console.log(`Templates inseridos: ${novos.length}`);
  console.log(`  Receitas: ${receitas.length}`);
  console.log(`  Despesas: ${despesas.length}`);
  console.log(`  Com categoria: ${comCategoria.length}`);
  console.log(`  Com cofrinho: ${comCofrinho.length}`);
  if (duplicatas > 0) console.log(`  Já existiam: ${duplicatas}`);
  if (erros.length > 0) console.log(`  Ignorados (erro): ${erros.length}`);
  console.log('\nSeed concluído com sucesso!');

  await queryClient.end();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
