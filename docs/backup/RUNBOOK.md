# Runbook — Backup e Restore do NossaGrana

> Issues #48/#49 (epic #44). Política, RPO/RTO e retenção: [POLICY.md](./POLICY.md).
> Pré-requisitos: `kubectl` com acesso ao cluster; para cópias restic, a senha
> do repositório e o `rclone.conf` (guardados fora do cluster).

## Visão rápida

```bash
kubectl get cronjob -n database pg-backup restic-backup nossagrana-restore-drill
kubectl get jobs -n database --sort-by=.metadata.creationTimestamp | tail
# Último relatório do drill (linha JSON final)
kubectl logs -n database -l app=nossagrana-restore-drill -c restore-drill --tail=1
```

No Loki/Grafana: `{namespace="database", container="restore-drill"} |= "restore_drill"`.

## Aplicar / atualizar os manifests

```bash
kubectl apply -k k8s/backup
# O ConfigMap do script tem hash no nome; remover versões antigas sem uso:
kubectl get cm -n database -o name | grep nossagrana-restore-drill-script
```

Rodar os testes antes de aplicar mudanças:

```bash
bash k8s/backup/tests/restore-drill.test.sh        # restore real via Docker
bash k8s/backup/tests/prometheusrule-backup.test.sh # promtool test rules
bash k8s/backup/tests/manifests.test.sh             # invariantes de isolamento
```

## Backup atrasado ou falhando

Alertas `NossaGranaBackupStale` / `NossaGranaBackupJobNotSucceeded` (`cronjob`
no label indica qual etapa).

1. Ver o Job mais recente e seus logs:
   ```bash
   kubectl get jobs -n database --sort-by=.metadata.creationTimestamp | grep <cronjob> | tail -3
   kubectl logs -n database job/<job>
   ```
2. Causas comuns:
   - `pg-backup`: Postgres fora do ar (`kubectl get pods -n database -l app=postgres`),
     "dump muito pequeno", disco cheio (ver [Espaço em disco](#espaço-em-disco)).
   - `restic-backup`: lock preso (o script já roda `restic unlock`), falha de
     rede/cota do Google Drive, `rclone` indisponível. O script tenta os dois
     destinos e o log diz qual falhou (`FALHA em: LocalUSB GoogleDrive`).
   - CronJob suspenso: `kubectl get cronjob -n database <cronjob> -o jsonpath='{.spec.suspend}'`.
3. Corrigir a causa e rodar manualmente:
   ```bash
   kubectl create job -n database --from=cronjob/<cronjob> <cronjob>-manual-$(date +%s)
   ```
4. O alerta resolve sozinho no próximo sucesso. Se o RPO foi violado, registrar
   abaixo.

## Restore drill falhando

Alertas `NossaGranaRestoreDrillStale` / `NossaGranaBackupJobNotSucceeded{cronjob="nossagrana-restore-drill"}`.

1. Ler o relatório: `kubectl logs -n database job/<job> -c restore-drill`. O campo
   `stage` diz onde falhou:

   | `stage`      | Significado                                  | Ação                                                |
   | ------------ | -------------------------------------------- | --------------------------------------------------- |
   | `select`     | nenhum `pg-all-*.sql.gz` no PVC              | `pg-backup` parou — seção anterior                  |
   | `freshness`  | dump mais novo > 26 h                        | `pg-backup` atrasado — seção anterior               |
   | `size`       | dump < 10 KB                                 | dump truncado; ver log do `pg-backup` do dia        |
   | `integrity`  | `gzip -t` falhou                             | arquivo corrompido; usar dump anterior/restic       |
   | `checksum`   | `.sha256` não confere                        | arquivo alterado após o dump; investigar            |
   | `scratch`    | Postgres descartável não subiu               | ver `kubectl logs ... -c scratch-postgres`, memória |
   | `extract`    | `nossagrana_prod` ausente do dump            | banco renomeado/removido? **incidente**             |
   | `restore`    | erro SQL no restore (primeira linha `ERROR`) | incompatibilidade de dump/versão; reproduzir local  |
   | `schema`     | tabela obrigatória ausente                   | dump incompleto ou migration destrutiva; investigar |
   | `migrations` | `drizzle.__drizzle_migrations` ausente/vazia | dump incompleto; investigar                         |
   | `data`       | `users`/`familias` vazias                    | possível perda de dados em produção; **incidente**  |

2. Reproduzir localmente com o mesmo dump (dados sensíveis: apagar depois):
   baixar o dump (ver [Restaurar em produção](#restaurar-em-produção), passo 1) e
   rodar o drill num Postgres local:
   ```bash
   docker run -d --name drill-pg -e POSTGRES_HOST_AUTH_METHOD=trust pgvector/pgvector:pg17
   docker run --rm --network container:drill-pg -v "$PWD/dumps:/backup:ro" \
     -v "$PWD/k8s/backup:/drill:ro" -e PGHOST=127.0.0.1 -e PGUSER=postgres \
     -e MAX_BACKUP_AGE_HOURS=9999 pgvector/pgvector:pg17 sh /drill/restore-drill.sh
   docker rm -f drill-pg
   ```
3. Após corrigir, rodar o drill manualmente:
   `kubectl create job -n database --from=cronjob/nossagrana-restore-drill nossagrana-restore-drill-manual-$(date +%s)`.

## CronJob ausente

Alerta `NossaGranaBackupCronJobMissing`.

- `nossagrana-restore-drill`: `kubectl apply -k k8s/backup` (este repo).
- `pg-backup`: `kubectl apply -f cluster/backup/cronjob-pg-backup-database.yaml`
  (repo `self-workflows`, branch `feat/cluster-ops`).
- `restic-backup`: manifest mantido fora deste repo; recriar a partir do backup
  de configuração do cluster.

## Espaço em disco

Alerta `NossaGranaBackupDiskLow`.

```bash
kubectl top node
kubectl run -n database disk-check --rm -it --restart=Never --image=alpine -- df -h
```

- `/` (PVCs local-path, inclusive `postgres-backup` com 14 dias de dumps): limpar
  imagens não usadas (`k3s crictl rmi --prune` no nó) antes de mexer em backups.
- `/srv/backups` (repositórios restic locais): conferir o `forget --prune` nos
  logs do `restic-backup`. **Nunca** apagar snapshots manualmente sem uma cópia
  externa válida e recente.

## Restaurar em produção

Decisão: restaurar só com incidente confirmado (perda/corrupção). O banco atual
**não é sobrescrito** — o backup é restaurado em paralelo e trocado por rename,
o que torna o rollback um rename de volta.

1. Obter o dump (`AAAA-MM-DD` desejado; `ls` lista os disponíveis):
   ```bash
   kubectl run -n database backup-fetch --restart=Never --image=postgres:17-alpine \
     --overrides='{"spec":{"containers":[{"name":"backup-fetch","image":"postgres:17-alpine","command":["sleep","3600"],"volumeMounts":[{"name":"b","mountPath":"/backup","readOnly":true}]}],"volumes":[{"name":"b","persistentVolumeClaim":{"claimName":"postgres-backup","readOnly":true}}]}}'
   kubectl exec -n database backup-fetch -- ls -l /backup
   kubectl cp database/backup-fetch:/backup/pg-all-AAAA-MM-DD.sql.gz ./pg-all.sql.gz
   kubectl delete pod -n database backup-fetch
   ```
   Se o PVC foi perdido, obter o arquivo do restic ([abaixo](#obter-dump-do-restic-usb-ou-google-drive)).
2. Extrair o banco para um nome paralelo (mesma lógica testada no drill):
   ```bash
   sh k8s/backup/extract-database.sh pg-all.sql.gz nossagrana_prod nossagrana_prod_restore > restore.sql
   ```
3. Restaurar no Postgres de produção, em banco novo, numa transação:
   ```bash
   kubectl exec -n database deploy/postgres -- sh -c 'createdb -U "$POSTGRES_USER" -O nossagrana_prod nossagrana_prod_restore'
   kubectl exec -i -n database deploy/postgres -- sh -c \
     'psql -U "$POSTGRES_USER" -v ON_ERROR_STOP=1 --single-transaction -q -d nossagrana_prod_restore' < restore.sql
   ```
4. Validar (contagens e última atividade esperada):
   ```bash
   kubectl exec -n database deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d nossagrana_prod_restore -c \
     "select (select count(*) from users) users, (select count(*) from familias) familias, (select max(data) from transacoes) ultima_transacao"'
   ```
5. Trocar com a API parada:
   ```bash
   kubectl scale deploy/nossagrana-api -n nossagrana --replicas=0
   kubectl exec -n database deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
     -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '\''nossagrana_prod'\''" \
     -c "alter database nossagrana_prod rename to nossagrana_prod_old_$(date +%Y%m%d)" \
     -c "alter database nossagrana_prod_restore rename to nossagrana_prod"'
   kubectl scale deploy/nossagrana-api -n nossagrana --replicas=1
   kubectl rollout status deploy/nossagrana-api -n nossagrana
   ```
6. **Rollback**: API a 0 réplicas, renomear `nossagrana_prod` →
   `nossagrana_prod_restore` e `nossagrana_prod_old_<data>` → `nossagrana_prod`,
   API a 1 réplica.
7. Apagar `pg-all.sql.gz` e `restore.sql` locais (contêm dados pessoais e
   financeiros). Manter `nossagrana_prod_old_<data>` até confirmar o restore.
8. Registrar abaixo: data, dump usado, duração, perda de dados (RPO real).

### Obter dump do restic (USB ou Google Drive)

Snapshots do namespace `database` usam `--host database --tag database` e
contêm `/data/postgres-backup/pg-all-*.sql.gz`.

```bash
export RESTIC_PASSWORD_FILE=./restic-password          # do gerenciador de senhas
# HD USB (no nó): /srv/backups/restic/database
# Google Drive (qualquer máquina com rclone configurado):
export RESTIC_REPOSITORY=rclone:gdrive:backups/elitedesk-restic-repo
restic snapshots --host database
restic restore latest --host database --target ./restic-restore \
  --include /data/postgres-backup/pg-all-AAAA-MM-DD.sql.gz
```

Depois seguir do passo 2. Em perda total do nó, subir primeiro um PostgreSQL 17
novo (mesma imagem `pgvector/pgvector:pg17`) e restaurar o dump inteiro:
`zcat pg-all-AAAA-MM-DD.sql.gz | psql -U <superuser> -d postgres` (recria roles e
todos os bancos do servidor compartilhado).

## Registro de exercícios e incidentes

| Data       | Tipo                 | Artefato                   | Resultado | Duração                | Notas                                                                                                                                          |
| ---------- | -------------------- | -------------------------- | --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | drill manual #1      | `pg-all-2026-09-22.sql.gz` | falha     | —                      | `stage=restore`: `GRANT CONNECT ON DATABASE nossagrana_prod TO grafana_ro` citava o nome original. Corrigido em `extract-database.sh` + teste. |
| 2026-09-22 | drill manual #2 a #5 | `pg-all-2026-09-22.sql.gz` | sucesso   | Job 12 s (restore 3 s) | 9 migrations, 12 tabelas obrigatórias, `users`/`familias` não vazias. Agendamento diário habilitado após 4 sucessos consecutivos.              |
