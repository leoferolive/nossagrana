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
-- é o total arquivado. Antes do deploy a tabela de auditoria ainda não existe e
-- a segunda consulta falha (esperado): a primeira já trouxe o que importa.
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

-- Só existe depois da 0012.
SELECT count(*)::int AS movidas_para_auditoria,
  count(DISTINCT (familia_id, mes_referencia))::int AS meses_afetados,
  min(movido_em) AS primeira_movida_em
FROM snapshots_mensais_duplicados;

ROLLBACK;
