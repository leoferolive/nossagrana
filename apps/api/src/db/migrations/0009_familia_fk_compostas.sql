-- Issue #58 (epic #54): FKs compostas (<ref>_id, familia_id) impedem, no banco,
-- que um registro financeiro referencie categoria/método/cofrinho/transação de
-- outra família. Gerada pelo drizzle-kit e ajustada à mão (ver
-- docs/security/OWNERSHIP-REFERENCIAS.md, seção "Constraints no banco"):
--   1. pré-checagem que aborta com mensagem clara se houver referência de outra
--      família ou órfã (a migration inteira roda numa transação: nada muda);
--   2. uniques (id, familia_id) ANTES das FKs que dependem deles (o drizzle-kit
--      os emitia por último, o que falharia);
--   3. ON DELETE SET NULL ("transacao_pai_id"): o drizzle-kit gera SET NULL sem
--      lista de colunas, que anularia também familia_id (NOT NULL);
--   4. FKs simples por id removidas por último: a composta as substitui.
-- Antes de tudo:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations); se o pod antigo segurar lock, falha rápido e o pod tenta
--     de novo, em vez de ficar parado na fila de locks. SET LOCAL vale só para
--     a transação única do migrator.
--   - órfãs de transacao_pai_id (pai apagado por DELETE /transacoes/:id antes
--     desta FK) são desvinculadas — exatamente o que o novo ON DELETE SET NULL
--     faria. Sem filtro por familia_id: pai de OUTRA família não é órfão e
--     continua abortando na pré-checagem.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
UPDATE "transacoes" f SET "transacao_pai_id" = NULL
WHERE f."transacao_pai_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "transacoes" p WHERE p."id" = f."transacao_pai_id");
--> statement-breakpoint
DO $$
DECLARE
  rel record;
  total bigint;
  problemas text := '';
BEGIN
  FOR rel IN
    SELECT * FROM (VALUES
      ('transacoes', 'categoria_id', 'categorias'),
      ('transacoes', 'metodo_pagamento_id', 'metodos_pagamento'),
      ('transacoes', 'cofrinho_id', 'cofrinhos'),
      ('transacoes', 'transacao_pai_id', 'transacoes'),
      ('orcamento_categoria', 'categoria_id', 'categorias'),
      ('templates_transacao', 'categoria_id', 'categorias'),
      ('templates_transacao', 'metodo_pagamento_id', 'metodos_pagamento'),
      ('templates_transacao', 'cofrinho_id', 'cofrinhos'),
      ('movimentacoes_cofrinho', 'cofrinho_id', 'cofrinhos'),
      ('movimentacoes_cofrinho', 'transacao_id', 'transacoes')
    ) AS r(tabela, coluna, alvo)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I f WHERE f.%I IS NOT NULL AND NOT EXISTS '
        '(SELECT 1 FROM %I p WHERE p.id = f.%I AND p.familia_id = f.familia_id)',
      rel.tabela, rel.coluna, rel.alvo, rel.coluna
    ) INTO total;
    IF total > 0 THEN
      problemas := problemas || format(' %s.%s=%s', rel.tabela, rel.coluna, total);
    END IF;
  END LOOP;
  IF problemas <> '' THEN
    RAISE EXCEPTION 'Migration 0009_familia_fk_compostas abortada, nada foi alterado. Referências de outra família ou órfãs:%. Diagnóstico: apps/api/src/db/diagnostics/ownership-referencias.sql', problemas;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_id_familia_id_unique" UNIQUE("id","familia_id");--> statement-breakpoint
ALTER TABLE "cofrinhos" ADD CONSTRAINT "cofrinhos_id_familia_id_unique" UNIQUE("id","familia_id");--> statement-breakpoint
ALTER TABLE "metodos_pagamento" ADD CONSTRAINT "metodos_pagamento_id_familia_id_unique" UNIQUE("id","familia_id");--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_id_familia_id_unique" UNIQUE("id","familia_id");--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" ADD CONSTRAINT "movimentacoes_cofrinho_cofrinho_familia_fk" FOREIGN KEY ("cofrinho_id","familia_id") REFERENCES "public"."cofrinhos"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" ADD CONSTRAINT "movimentacoes_cofrinho_transacao_familia_fk" FOREIGN KEY ("transacao_id","familia_id") REFERENCES "public"."transacoes"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "orcamento_categoria_categoria_familia_fk" FOREIGN KEY ("categoria_id","familia_id") REFERENCES "public"."categorias"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_categoria_familia_fk" FOREIGN KEY ("categoria_id","familia_id") REFERENCES "public"."categorias"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_metodo_pagamento_familia_fk" FOREIGN KEY ("metodo_pagamento_id","familia_id") REFERENCES "public"."metodos_pagamento"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_cofrinho_familia_fk" FOREIGN KEY ("cofrinho_id","familia_id") REFERENCES "public"."cofrinhos"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_categoria_familia_fk" FOREIGN KEY ("categoria_id","familia_id") REFERENCES "public"."categorias"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_metodo_pagamento_familia_fk" FOREIGN KEY ("metodo_pagamento_id","familia_id") REFERENCES "public"."metodos_pagamento"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_cofrinho_familia_fk" FOREIGN KEY ("cofrinho_id","familia_id") REFERENCES "public"."cofrinhos"("id","familia_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_transacao_pai_familia_fk" FOREIGN KEY ("transacao_pai_id","familia_id") REFERENCES "public"."transacoes"("id","familia_id") ON DELETE SET NULL ("transacao_pai_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" DROP CONSTRAINT "movimentacoes_cofrinho_cofrinho_id_cofrinhos_id_fk";--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" DROP CONSTRAINT "movimentacoes_cofrinho_transacao_id_transacoes_id_fk";--> statement-breakpoint
ALTER TABLE "orcamento_categoria" DROP CONSTRAINT "orcamento_categoria_categoria_id_categorias_id_fk";--> statement-breakpoint
ALTER TABLE "templates_transacao" DROP CONSTRAINT "templates_transacao_categoria_id_categorias_id_fk";--> statement-breakpoint
ALTER TABLE "templates_transacao" DROP CONSTRAINT "templates_transacao_metodo_pagamento_id_metodos_pagamento_id_fk";--> statement-breakpoint
ALTER TABLE "templates_transacao" DROP CONSTRAINT "templates_transacao_cofrinho_id_cofrinhos_id_fk";--> statement-breakpoint
ALTER TABLE "transacoes" DROP CONSTRAINT "transacoes_categoria_id_categorias_id_fk";--> statement-breakpoint
ALTER TABLE "transacoes" DROP CONSTRAINT "transacoes_metodo_pagamento_id_metodos_pagamento_id_fk";
