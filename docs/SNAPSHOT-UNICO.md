# Snapshot mensal único (migration 0012, issue #69)

Cada família tem no máximo um snapshot por mês: unique index
`snapshots_mensais_familia_mes_uq` em `(familia_id, mes_referencia)`. A criação
é idempotente (`ON CONFLICT DO NOTHING` + retorno do existente); um snapshot
existente nunca é recalculado nem alterado.

## O que a migration faz

1. `SET LOCAL lock_timeout = '5s'` e `LOCK TABLE snapshots_mensais IN ACCESS EXCLUSIVE MODE`.
2. Cria `snapshots_mensais_duplicados` (mesmas colunas + `movido_em`).
3. Move as duplicatas para ela (canônico = menor `gerado_em`; empate, menor `id`).
4. Remove o índice composto antigo e cria o unique index. Tudo numa transação.

## Antes do deploy

```bash
kubectl exec -i -n database deploy/postgres -- sh -c \
  'psql -U "$POSTGRES_USER" -d nossagrana_prod' \
  < apps/api/src/db/diagnostics/auditoria-snapshots-duplicados.sql
```

`linhas_a_mover` indica quantas linhas irão para a auditoria. Depois do deploy,
`grupos_duplicados` deve ser 0 (a segunda consulta, de auditoria, só funciona
após a migration).

## Risco de deploy: janela de backup

A migration roda no startup da API (`runMigrations`) e exige ACCESS EXCLUSIVE.
Se coincidir com um backup (`pg_dump` segura ACCESS SHARE), ela falha por
`lock_timeout` em 5 s (erro 55P03), o pod entra em crashloop e a API fica fora
do ar até o backup terminar. Nada fica aplicado pela metade.

Janela a evitar (America/Sao_Paulo): `pg-backup` 03:20, `pg-dump-external`
03:35 (`k8s/backup/pg-dump-external/base/cronjob.yaml`), restore drill 03:50
(`k8s/backup/cronjob-restore-drill.yaml`) e `restic-backup` 04:00. Faça o deploy
fora de 03:15 a 04:30 e confirme `kubectl get jobs -n database` sem job de backup
ativo.

## Rollback manual

O deploy anterior do código continua funcionando sem o índice único. Para
desfazer o schema:

```sql
BEGIN;
DROP INDEX snapshots_mensais_familia_mes_uq;
CREATE INDEX snapshots_mensais_familia_mes_idx
  ON snapshots_mensais (familia_id, mes_referencia);
-- Opcional: reinserir as linhas movidas (recria as duplicatas).
INSERT INTO snapshots_mensais (id, familia_id, mes_referencia, total_receitas,
  total_despesas, saldo, dados_categorias, dados_usuarios, divergente, gerado_em)
SELECT id, familia_id, mes_referencia, total_receitas, total_despesas, saldo,
  dados_categorias, dados_usuarios, divergente, gerado_em
FROM snapshots_mensais_duplicados;
COMMIT;
```

Depois, remova a entrada `0012_snapshot_unico` de `drizzle.__drizzle_migrations`
se for reaplicar a migration. `snapshots_mensais_duplicados` pode ser mantida.
