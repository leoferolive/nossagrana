-- Diagnóstico de referências financeiras cross-tenant (issue #55, epic #54).
--
-- SOMENTE LEITURA. Retorna apenas contagens por relacionamento — nenhum dado
-- de linha — para rodar em produção antes de qualquer backfill/constraint:
--
--   kubectl exec -i -n database deploy/postgres -- sh -c \
--     'psql -U "$POSTGRES_USER" -d nossagrana_prod -v ON_ERROR_STOP=1' \
--     < apps/api/src/db/diagnostics/ownership-referencias.sql
--
-- Pré-checagem recomendada antes de aplicar a migration 0009_familia_fk_compostas
-- (#58) em qualquer ambiente, logo antes do deploy: "outra_familia" e "orfa"
-- precisam estar zerados (exceto "orfa" em transacoes.transacao_pai_id, que a
-- migration desvincula sozinha), senão ela aborta sem alterar nada
-- (docs/security/OWNERSHIP-REFERENCIAS.md).
--
-- "outra_familia": a referência aponta para registro de outra família.
-- "orfa": o registro referenciado não existe (FK ausente, ex.: cofrinho_id).
-- "tipo_incompativel"/"inativa": mesma família, estado não permitido hoje.
BEGIN TRANSACTION READ ONLY;

SELECT relacionamento, problema, count(*) AS total
FROM (
  SELECT 'transacoes.categoria_id' AS relacionamento,
    CASE
      WHEN c.id IS NULL THEN 'orfa'
      WHEN c.familia_id <> t.familia_id THEN 'outra_familia'
      WHEN c.tipo::text <> t.tipo::text THEN 'tipo_incompativel'
      WHEN NOT c.ativo THEN 'inativa'
    END AS problema
  FROM transacoes t LEFT JOIN categorias c ON c.id = t.categoria_id

  UNION ALL
  SELECT 'transacoes.metodo_pagamento_id',
    CASE
      WHEN m.id IS NULL THEN 'orfa'
      WHEN m.familia_id <> t.familia_id THEN 'outra_familia'
      WHEN NOT m.ativo THEN 'inativa'
    END
  FROM transacoes t LEFT JOIN metodos_pagamento m ON m.id = t.metodo_pagamento_id
  WHERE t.metodo_pagamento_id IS NOT NULL

  UNION ALL
  SELECT 'transacoes.cofrinho_id',
    CASE
      WHEN cf.id IS NULL THEN 'orfa'
      WHEN cf.familia_id <> t.familia_id THEN 'outra_familia'
    END
  FROM transacoes t LEFT JOIN cofrinhos cf ON cf.id = t.cofrinho_id
  WHERE t.cofrinho_id IS NOT NULL

  UNION ALL
  SELECT 'transacoes.transacao_pai_id',
    CASE
      WHEN p.id IS NULL THEN 'orfa'
      WHEN p.familia_id <> t.familia_id THEN 'outra_familia'
    END
  FROM transacoes t LEFT JOIN transacoes p ON p.id = t.transacao_pai_id
  WHERE t.transacao_pai_id IS NOT NULL

  UNION ALL
  SELECT 'orcamento_categoria.categoria_id',
    CASE
      WHEN c.id IS NULL THEN 'orfa'
      WHEN c.familia_id <> o.familia_id THEN 'outra_familia'
      WHEN NOT c.ativo THEN 'inativa'
    END
  FROM orcamento_categoria o LEFT JOIN categorias c ON c.id = o.categoria_id

  UNION ALL
  SELECT 'templates_transacao.categoria_id',
    CASE
      WHEN c.id IS NULL THEN 'orfa'
      WHEN c.familia_id <> tt.familia_id THEN 'outra_familia'
      WHEN c.tipo::text <> tt.tipo::text THEN 'tipo_incompativel'
      WHEN NOT c.ativo THEN 'inativa'
    END
  FROM templates_transacao tt LEFT JOIN categorias c ON c.id = tt.categoria_id
  WHERE tt.categoria_id IS NOT NULL

  UNION ALL
  SELECT 'templates_transacao.metodo_pagamento_id',
    CASE
      WHEN m.id IS NULL THEN 'orfa'
      WHEN m.familia_id <> tt.familia_id THEN 'outra_familia'
      WHEN NOT m.ativo THEN 'inativa'
    END
  FROM templates_transacao tt LEFT JOIN metodos_pagamento m ON m.id = tt.metodo_pagamento_id
  WHERE tt.metodo_pagamento_id IS NOT NULL

  UNION ALL
  SELECT 'templates_transacao.cofrinho_id',
    CASE
      WHEN cf.id IS NULL THEN 'orfa'
      WHEN cf.familia_id <> tt.familia_id THEN 'outra_familia'
      WHEN cf.status <> 'ativo' THEN 'inativa'
    END
  FROM templates_transacao tt LEFT JOIN cofrinhos cf ON cf.id = tt.cofrinho_id
  WHERE tt.cofrinho_id IS NOT NULL

  UNION ALL
  SELECT 'movimentacoes_cofrinho.cofrinho_id',
    CASE
      WHEN cf.id IS NULL THEN 'orfa'
      WHEN cf.familia_id <> mc.familia_id THEN 'outra_familia'
    END
  FROM movimentacoes_cofrinho mc LEFT JOIN cofrinhos cf ON cf.id = mc.cofrinho_id

  UNION ALL
  SELECT 'movimentacoes_cofrinho.transacao_id',
    CASE
      WHEN t.id IS NULL THEN 'orfa'
      WHEN t.familia_id <> mc.familia_id THEN 'outra_familia'
    END
  FROM movimentacoes_cofrinho mc LEFT JOIN transacoes t ON t.id = mc.transacao_id
  WHERE mc.transacao_id IS NOT NULL
) AS verificacoes
WHERE problema IS NOT NULL
GROUP BY relacionamento, problema
ORDER BY relacionamento, problema;

ROLLBACK;
