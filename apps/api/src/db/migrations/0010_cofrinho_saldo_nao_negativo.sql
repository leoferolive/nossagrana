-- Issue #62 (epic #59): CHECK (saldo_atual >= 0) em "cofrinhos" — última defesa
-- contra saldo negativo mesmo fora do repositório (a retirada já usa UPDATE
-- condicional "saldo_atual >= valor"). Gerada pelo drizzle-kit (só o ALTER) e
-- ajustada à mão, no mesmo padrão da 0009:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations); se outro processo segurar lock em "cofrinhos", falha
--     rápido e o pod tenta de novo. SET LOCAL vale só para a transação única do
--     migrator.
--   - pré-checagem: se já existir saldo negativo, aborta com mensagem clara e a
--     migration inteira (uma transação) não altera nada. Não corrige dados:
--     investigar antes com apps/api/src/db/diagnostics/reconciliacao-cofrinhos.sql.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DO $$
DECLARE
  negativos bigint;
BEGIN
  -- Trava "cofrinhos" até o fim da migration: nenhum saldo negativo entra
  -- entre a contagem e o ADD CONSTRAINT. ACCESS EXCLUSIVE já é o modo que o
  -- ADD CONSTRAINT CHECK pede — pegá-lo de uma vez evita upgrade de lock
  -- (e deadlock com outra transação) quando a 0010 roda sozinha.
  LOCK TABLE "cofrinhos" IN ACCESS EXCLUSIVE MODE;
  SELECT count(*) INTO negativos FROM "cofrinhos" WHERE "saldo_atual" < 0;
  IF negativos > 0 THEN
    RAISE EXCEPTION 'Migration 0010_cofrinho_saldo_nao_negativo abortada, nada foi alterado. cofrinhos com saldo negativo: %. Diagnóstico: apps/api/src/db/diagnostics/reconciliacao-cofrinhos.sql', negativos;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "cofrinhos" ADD CONSTRAINT "cofrinhos_saldo_atual_nao_negativo" CHECK ("cofrinhos"."saldo_atual" >= 0);
