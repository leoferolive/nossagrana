-- Auditoria de snapshots mensais duplicados (issue #69, migration 0012).
--
-- SOMENTE LEITURA. Retorna apenas contagens agregadas (sem dados de linha):
--
--   kubectl exec -i -n database deploy/postgres -- sh -c \
--     'psql -U "$POSTGRES_USER" -d nossagrana_prod -v ON_ERROR_STOP=1' \
--     < apps/api/src/db/diagnostics/auditoria-snapshots-duplicados.sql
--
-- ANTES do deploy (a 0012 ainda não aplicada): "grupos_duplicados" e
-- "linhas_a_mover" mostram quantas linhas a migration vai mover para
-- snapshots_mensais_duplicados (o canônico, o mais antigo, permanece).
-- DEPOIS do deploy: "grupos_duplicados" deve ser 0 e "movidas_para_auditoria"
-- é o total arquivado (reportado via NOTICE; antes do deploy avisa que a tabela
-- ainda não existe).
BEGIN TRANSACTION READ ONLY;

SELECT
  count(*)::int AS grupos_duplicados,
  coalesce(sum(n - 1), 0)::int AS linhas_a_mover
FROM (
  SELECT count(*) AS n
  FROM snapshots_mensais
  GROUP BY familia_id, mes_referencia
  HAVING count(*) > 1
) d;

-- Só existe depois da 0012: antes dela, avisa por NOTICE em vez de falhar
-- (plpgsql só resolve a tabela se o ramo for executado).
DO $$
DECLARE
  movidas int;
  meses int;
BEGIN
  IF to_regclass('snapshots_mensais_duplicados') IS NULL THEN
    RAISE NOTICE 'snapshots_mensais_duplicados: tabela ainda não existe (0012 não aplicada)';
    RETURN;
  END IF;
  SELECT count(*)::int, count(DISTINCT (familia_id, mes_referencia))::int
    INTO movidas, meses FROM snapshots_mensais_duplicados;
  RAISE NOTICE 'movidas_para_auditoria=%, meses_afetados=%', movidas, meses;
END
$$;

ROLLBACK;
