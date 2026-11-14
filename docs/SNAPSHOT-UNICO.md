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
  'psql -U "$POSTGRES_USER" -d nossagrana_prod -v ON_ERROR_STOP=1' \
  < apps/api/src/db/diagnostics/auditoria-snapshots-duplicados.sql
```

`linhas_a_mover` indica quantas linhas irão para a auditoria. Depois do deploy,
`grupos_duplicados` deve ser 0. A segunda consulta (auditoria) avisa via NOTICE
quando a tabela ainda não existe, sem gerar erro.

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

### Reaplicar a 0012 depois do rollback

Só funciona se a 0012 for a **última** migration aplicada: o migrator do Drizzle
compara apenas com o `created_at` mais recente registrado. Como o `CREATE TABLE`
da 0012 não usa `IF NOT EXISTS`, a tabela de auditoria precisa sair do caminho
antes (senão: `relation "snapshots_mensais_duplicados" already exists` e
crashloop do pod):

```sql
BEGIN;
-- Preserva o arquivo morto (ou exporte e dê DROP).
ALTER TABLE snapshots_mensais_duplicados
  RENAME TO snapshots_mensais_duplicados_AAAAMMDD;
-- created_at = "when" da 0012 em apps/api/src/db/migrations/meta/_journal.json.
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794335929572;
COMMIT;
```

Confira o valor no journal antes de executar. Em seguida reinicie a API para o
`runMigrations` reaplicar a 0012.
