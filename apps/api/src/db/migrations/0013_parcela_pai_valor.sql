-- Nova UI, Entrega 1 (docs/superpowers/specs/2026-11-15-nova-ui-entrega-1-design.md):
-- o lançamento pai de um parcelamento é a parcela 1, mas era gravado com
-- "valor" igual ao total da compra; só as filhas recebiam o valor da parcela.
-- Como dashboard, orçamento, fatura e histórico somam "valor", uma compra de
-- R$ 1.299,90 em 10x pesava R$ 2.469,81 ao longo dos meses. Migration de dados
-- escrita à mão (drizzle-kit generate --custom), no padrão da 0010/0012:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations), numa transação única do migrator; se as linhas estiverem
--     travadas, falha rápido e o pod tenta de novo. SET LOCAL vale só nela.
--   - só toca o pai de parcelamento (sem transacao_pai_id, parcela 1) cujo
--     "valor" ainda é igual a "valor_total". Um pai já editado à mão fica como
--     está, e rodar de novo não muda nada: depois da correção a condição deixa
--     de valer.
--   - não destrutiva: o total da compra continua em "valor_total". Para
--     desfazer: UPDATE transacoes SET valor = valor_total com o mesmo filtro,
--     trocando a última condição por "valor = valor_parcela".
--   - snapshot original nunca é recalculado: os snapshots dos meses cujo total
--     mudou são apenas marcados como divergentes, na mesma instrução.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
WITH corrigidas AS (
  UPDATE "transacoes"
     SET "valor" = "valor_parcela"
   WHERE "parcelado" = true
     AND "transacao_pai_id" IS NULL
     AND "parcela_atual" = 1
     AND "numero_parcelas" > 1
     AND "valor_parcela" IS NOT NULL
     AND "valor" = "valor_total"
  RETURNING "familia_id", "mes_referencia"
)
UPDATE "snapshots_mensais" AS s
   SET "divergente" = true
  FROM corrigidas AS c
 WHERE s."familia_id" = c."familia_id"
   AND s."mes_referencia" = c."mes_referencia";
