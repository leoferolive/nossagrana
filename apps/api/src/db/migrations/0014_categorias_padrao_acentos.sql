-- Nova UI, Entrega 1 (docs/superpowers/specs/2026-11-15-nova-ui-entrega-1-design.md):
-- as categorias padrão de toda família nova eram gravadas sem acento
-- (Alimentacao, Saude, Educacao, Salario, Bonus). O seed foi corrigido; esta
-- migration acerta as famílias que já existem. Migration de dados escrita à
-- mão (drizzle-kit generate --custom), no padrão da 0010/0012/0013:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations), numa transação única do migrator; se as linhas estiverem
--     travadas, falha rápido e o pod tenta de novo. SET LOCAL vale só nela.
--   - só renomeia a categoria que ainda tem exatamente o nome antigo, no tipo
--     em que ele é categoria padrão. Rodar de novo não muda nada.
--   - pula a família que já tem uma categoria com o nome acentuado no mesmo
--     tipo, para não deixar duas categorias de mesmo nome.
--   - só o nome muda; o id continua o mesmo, então transações, orçamentos e
--     modelos seguem apontando para a mesma categoria. Snapshots antigos
--     guardam o nome da época e não são alterados.
--   - para desfazer: o mesmo UPDATE com as colunas "antigo" e "novo" trocadas.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
UPDATE "categorias" AS c
   SET "nome" = m.novo
  FROM (VALUES
         ('Alimentacao', 'Alimentação', 'despesa'),
         ('Saude', 'Saúde', 'despesa'),
         ('Educacao', 'Educação', 'despesa'),
         ('Salario', 'Salário', 'receita'),
         ('Bonus', 'Bônus', 'receita')
       ) AS m(antigo, novo, tipo)
 WHERE c."nome" = m.antigo
   AND c."tipo"::text = m.tipo
   AND NOT EXISTS (
         SELECT 1
           FROM "categorias" AS d
          WHERE d."familia_id" = c."familia_id"
            AND d."tipo" = c."tipo"
            AND d."nome" = m.novo
       );
