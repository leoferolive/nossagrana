-- Reconciliação de saldos de cofrinhos (issues #59/#61/#63).
--
-- SOMENTE LEITURA. Retorna apenas contagens agregadas — nenhum dado de linha —
-- para rodar em produção antes/depois de deploys que mexem em cofrinhos e
-- antes da migration 0010_cofrinho_saldo_nao_negativo:
--
--   kubectl exec -i -n database deploy/postgres -- sh -c \
--     'psql -U "$POSTGRES_USER" -d nossagrana_prod -v ON_ERROR_STOP=1' \
--     < apps/api/src/db/diagnostics/reconciliacao-cofrinhos.sql
--
-- Invariante: saldo_atual (materializado) = Σ aportes − Σ retiradas de
-- movimentacoes_cofrinho do mesmo cofrinho E da mesma família.
--   "divergentes":   cofrinhos cujo saldo materializado difere do ledger;
--   "saldo_negativo": cofrinhos com saldo < 0 (a 0010 aborta se > 0);
--   "diferenca_absoluta_total": soma de |saldo − ledger| (tamanho do problema).
-- Tudo zerado = consistente. O mesmo arquivo roda nos testes PostgreSQL
-- (apps/api/src/db/tests/cofrinho-atomico.pg.test.ts).
BEGIN TRANSACTION READ ONLY;

SELECT
  count(*)::int AS total_cofrinhos,
  count(*) FILTER (WHERE c.saldo_atual <> coalesce(l.saldo_ledger, 0))::int AS divergentes,
  count(*) FILTER (WHERE c.saldo_atual < 0)::int AS saldo_negativo,
  coalesce(sum(abs(c.saldo_atual - coalesce(l.saldo_ledger, 0))), 0)::numeric(14, 2)
    AS diferenca_absoluta_total
FROM cofrinhos c
LEFT JOIN (
  SELECT cofrinho_id, familia_id,
    sum(CASE WHEN tipo = 'aporte' THEN valor ELSE -valor END) AS saldo_ledger
  FROM movimentacoes_cofrinho
  GROUP BY cofrinho_id, familia_id
) l ON l.cofrinho_id = c.id AND l.familia_id = c.familia_id;

ROLLBACK;
