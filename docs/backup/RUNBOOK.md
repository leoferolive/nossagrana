# Runbook — Backup e Restore do NossaGrana

> Issues #48/#49 (epic #44). Política, RPO/RTO e retenção: [POLICY.md](./POLICY.md).
> Pré-requisitos: `kubectl` com acesso ao cluster; para cópias restic, a senha
> do repositório e o `rclone.conf` (guardados fora do cluster).

## Visão rápida

```bash
kubectl get cronjob -n database pg-backup restic-backup pg-dump-external nossagrana-restore-drill
kubectl get jobs -n database --sort-by=.metadata.creationTimestamp | tail
# Último relatório do drill (linha JSON final)
kubectl logs -n database -l app=nossagrana-restore-drill -c restore-drill --tail=1
```

No Loki/Grafana: `{namespace="database", container="restore-drill"} |= "restore_drill"`.

## Aplicar / atualizar os manifests

```bash
kubectl apply -k k8s/backup                            # restore drill + alertas
kubectl apply -k k8s/backup/pg-dump-external/enabled   # dump cifrado externo (em produção)
# Os ConfigMaps dos scripts têm hash no nome; remover versões antigas sem uso:
kubectl get cm -n database -o name | grep -E 'nossagrana-restore-drill-script|pg-dump-external-script'
```

> **Overlays do `pg-dump-external`.** O estado do agendamento vive no repo, não no
> cluster: `.../pg-dump-external/enabled` declara `suspend: false` (uso normal, inclusive
> para atualizar o script) e `.../pg-dump-external/suspended` é o rollout/rollback.
> Reaplicar `enabled` nunca suspende o backup; aplicar `suspended` suspende **de propósito**.
> A raiz `k8s/backup/pg-dump-external` não tem `kustomization.yaml` (o `apply -k` nela falha
> em vez de mudar o `suspend` em silêncio). Conferir:
>
> ```bash
> kubectl get cronjob -n database pg-dump-external -o jsonpath='{.spec.suspend}'   # produção: false
> ```

Ordem no primeiro rollout: aplicar `pg-dump-external` **antes** de `k8s/backup`, senão
`NossaGranaBackupCronJobMissing` dispara 1 h depois de as regras entrarem.

Rodar os testes antes de aplicar mudanças:

```bash
bash k8s/backup/tests/restore-drill.test.sh        # restore real via Docker
bash k8s/backup/tests/prometheusrule-backup.test.sh # promtool test rules
bash k8s/backup/tests/manifests.test.sh             # invariantes de isolamento
bash k8s/backup/tests/pg-dump-external-manifests.test.sh # invariantes do dump externo
bash k8s/backup/tests/pg-dump-external.test.sh      # job com fakes (sem Docker/rede)
bash k8s/backup/tests/pg-dump-external.smoke.test.sh # job real: imagem, PostgreSQL, age, rclone
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
   - CronJob suspenso (não dispara `Stale`; ver [CronJob suspenso](#cronjob-suspenso)): `kubectl get cronjob -n database <cronjob> -o jsonpath='{.spec.suspend}'`.
3. Corrigir a causa e rodar manualmente:
   ```bash
   kubectl create job -n database --from=cronjob/<cronjob> <cronjob>-manual-$(date +%s)
   ```
4. O alerta resolve sozinho no próximo sucesso. Se o RPO foi violado, registrar
   abaixo.

## CronJob suspenso

Alerta `NossaGranaBackupCronJobSuspended` (warning): um CronJob de backup está com
`spec.suspend=true` há mais de 24 h. `NossaGranaBackupStale` **ignora** CronJobs
suspensos (um Job manual criado com `--from=cronjob/...` preenche o
`last_successful_time` do CronJob e o rollout/rollback do `pg-dump-external`
fica suspenso por horas), então este alerta é a garantia de que uma suspensão
esquecida não deixa o backup parado em silêncio.

1. Confirmar: `kubectl get cronjob -n database -o custom-columns=NOME:.metadata.name,SUSPENSO:.spec.suspend`.
2. Se a suspensão é intencional (rollout do `pg-dump-external` ainda sem restore
   exercitado), concluir o rollout ([passos](#rollout-cronjob-nasce-suspenso)) ou
   registrar por que continua suspenso.
3. Se não é: `kubectl patch cronjob -n database <cronjob> -p '{"spec":{"suspend":false}}'`
   (no `pg-dump-external`, prefira `kubectl apply -k k8s/backup/pg-dump-external/enabled`,
   que deixa `suspend: false` versionado) e rodar um Job manual ([Backup atrasado ou falhando](#backup-atrasado-ou-falhando), passo 3).

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
- `pg-dump-external`: `kubectl apply -k k8s/backup/pg-dump-external/enabled` (este repo;
  os Secrets não estão no repo — ver [Dump cifrado externo](#dump-cifrado-externo-pg-dump-external)).
  Antes do primeiro rollout concluído, use o overlay `suspended`.
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

## Dump cifrado externo (pg-dump-external)

Issue #47. `pg_dump -Fc` de `nossagrana_prod` → valida (tamanho e
`pg_restore --list`) → cifra com **age** para uma chave pública → SHA-256 →
upload por rclone (artefato, `.sha256`, `.meta.json`) → baixa de volta e compara →
retenção. Código em `k8s/backup/pg-dump-external/base/pg-dump-external.sh`; manifests
e imagem na mesma pasta. Política em [POLICY.md](./POLICY.md).

Artefatos no destino (`<banco>` = `nossagrana_prod`):

```
<banco>-20260930T063500Z-<pod>.dump.age            # dump cifrado (age)
<banco>-20260930T063500Z-<pod>.dump.age.sha256     # sha256 do arquivo cifrado
<banco>-20260930T063500Z-<pod>.dump.age.meta.json  # metadata (último a ser enviado)
```

### Preparar (uma vez)

1. **Chave age** — gerar fora do cluster e guardar a privada no gerenciador de senhas:
   ```bash
   age-keygen -o nossagrana-backup.key   # imprime "Public key: age1..."
   ```
2. **Role de leitura** no PostgreSQL compartilhado (não usar o superusuário). Gere
   a senha numa variável (hexadecimal: sem aspas nem caracteres que quebrem o literal
   SQL abaixo), fora do histórico do shell, e reaproveite-a no passo 3 (o Secret é
   criado a partir da mesma variável, não de um arquivo):
   ```bash
   BACKUP_RO_PASSWORD="$(openssl rand -hex 24)"
   kubectl exec -i -n database deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1' <<SQL
   CREATE ROLE backup_ro LOGIN PASSWORD '$BACKUP_RO_PASSWORD';
   SQL
   kubectl exec -i -n database deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d nossagrana_prod -v ON_ERROR_STOP=1' \
     < k8s/backup/pg-dump-external/grant-backup-ro.sql
   ```
   O `grant-backup-ro.sql` dá `SELECT` só em `nossagrana_prod` (schemas `public` e
   `drizzle`, com default privileges para tabelas futuras). **Não** use
   `pg_read_all_data`: é um role do cluster e abriria os demais bancos do servidor
   a quem obtivesse o Secret. O smoke test aplica esse mesmo arquivo e prova que o
   role não lê outro banco.
3. **Secrets** (valores só na sua máquina; nada disso vai para o repositório). Use
   `--from-literal` com a variável do passo 2: gerar um arquivo com `echo` deixaria
   um `\n` no fim da senha e a autenticação falharia.
   ```bash
   kubectl create secret generic pg-dump-external-db -n database \
     --from-literal=user=backup_ro --from-literal=password="$BACKUP_RO_PASSWORD"
   kubectl create secret generic pg-dump-external-storage -n database \
     --from-file=rclone.conf=./rclone.conf \
     --from-literal=remote='<remoto-rclone>:<pasta>' \
     --from-literal=age-recipient='age1...'
   ```
   O `rclone.conf` é montado **somente leitura**: prefira remotos sem renovação de
   token (S3/B2/SFTP, ou Drive com service account). Um remoto OAuth que precise
   regravar o refresh token vai logar erro de escrita do rclone.
4. **Imagem** (linux/arm64, só ferramentas: `postgresql17-client`, `age`, `rclone`):
   ```bash
   docker buildx build --platform linux/arm64 \
     -t ghcr.io/leoferolive/nossagrana-pg-dump-external:1.0.0 --push k8s/backup/pg-dump-external
   ```
   Ao mudar a versão, atualizar a tag em `base/cronjob.yaml`.

### Rollout (CronJob nasce suspenso)

```bash
kubectl apply -k k8s/backup/pg-dump-external/suspended
kubectl create job -n database --from=cronjob/pg-dump-external pg-dump-external-manual-$(date +%s)
kubectl logs -n database -l app=pg-dump-external --tail=20     # última linha: result=success
```

1. Conferir no destino os três objetos e o `sha256sum -c` ([Verificar um artefato](#verificar-um-artefato)).
2. Exercitar um restore completo a partir do artefato
   ([Restaurar](#restaurar-a-partir-do-dump-externo)) e registrar na tabela de exercícios.
3. Só então habilitar o agendamento:
   `kubectl apply -k k8s/backup/pg-dump-external/enabled`. Desse ponto em diante, use
   sempre `enabled` (reaplicar mantém `suspend: false`).
4. **Rollback**: `kubectl apply -k k8s/backup/pg-dump-external/suspended`. Nenhuma cópia
   anterior é apagada (a retenção só roda depois de um upload verificado).

Enquanto o CronJob está suspenso (rollout e rollback), `NossaGranaBackupStale` não
dispara; só o aviso `NossaGranaBackupCronJobSuspended` após 24 h
([CronJob suspenso](#cronjob-suspenso)). Não deixe o rollout parado além disso.

Limite de tamanho: o `emptyDir` `/work` tem `sizeLimit: 1Gi` e o pico de uso é
cerca de **duas vezes o tamanho do dump** (dump em claro + artefato cifrado e,
depois, artefato + cópia baixada para verificação). Na prática o dump comprimido
pode ir até ~500 MB; acima disso o pod é despejado (evict) **sem** o JSON de falha
no log. O dump atual tem poucos MB; ao se aproximar do limite, aumentar o
`sizeLimit` em `base/cronjob.yaml`.

### Falhas (`stage` no JSON final)

`kubectl logs -n database job/<job>`; a última linha é
`{"event":"pg_dump_external","result":"failure","stage":...,"reason":...}`.

| `stage`         | Significado                                            | Ação                                                                                          |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `config`        | variável ausente/inválida ou `AGE_RECIPIENT` errado    | corrigir Secret/env; chave `AGE-SECRET-KEY-` no recipient = **trocar**                        |
| `dump`          | conexão, permissão ou timeout do `pg_dump`             | Postgres no ar? senha do `backup_ro`? `DUMP_TIMEOUT_SECONDS` (`reason` diz "timeout após Ns") |
| `verify_dump`   | dump < 10 KB ou TOC ilegível                           | dump truncado; ver logs do Postgres, rodar de novo                                            |
| `encrypt`       | `age` falhou                                           | recipient válido? memória do pod                                                              |
| `upload`        | rclone falhou após as tentativas, ou objeto já existia | credencial/cota/rede do destino; objeto existente **nunca** é sobrescrito                     |
| `verify_upload` | objeto no destino difere do enviado                    | corrupção ou outro job no mesmo nome; investigar o destino                                    |

`retention_ok=false` no relatório de sucesso = a limpeza falhou, o backup está
íntegro; ver o aviso no log e o espaço do destino.

Falhas em `upload`/`verify_upload` podem deixar objetos no destino. O `.meta.json`
só sobe depois de artefato e `.sha256` estarem enviados **e conferidos**, então um
artefato **sem `.meta.json` é órfão** (upload parcial ou verificação falha): não é
um backup válido, não conta para o mínimo de 7 da retenção e é removido pela
retenção depois de 30 dias. Para restaurar, use só artefatos com `.meta.json`.

### Verificar um artefato

O `.sha256` cita o nome original do artefato: baixe os dois arquivos **com o mesmo
nome que têm no destino** (renomear quebra o `sha256sum -c`).

```bash
ARTEFATO='<artefato>.dump.age'          # nome exato listado no destino
rclone copyto "<remoto>:<pasta>/$ARTEFATO" "./$ARTEFATO"
rclone copyto "<remoto>:<pasta>/$ARTEFATO.sha256" "./$ARTEFATO.sha256"
sha256sum -c "$ARTEFATO.sha256"
```

### Restaurar a partir do dump externo

Exige a chave privada (fora do cluster). Restaura em banco paralelo e troca por
rename, como em [Restaurar em produção](#restaurar-em-produção):

```bash
age -d -i nossagrana-backup.key -o restore.dump "$ARTEFATO"    # $ARTEFATO: ver acima
pg_restore --list restore.dump | head            # confere o TOC
kubectl exec -n database deploy/postgres -- sh -c 'createdb -U "$POSTGRES_USER" -O nossagrana_prod nossagrana_prod_restore'
kubectl exec -i -n database deploy/postgres -- sh -c \
  'pg_restore -U "$POSTGRES_USER" --no-owner --role=nossagrana_prod --exit-on-error -d nossagrana_prod_restore' < restore.dump
```

**Configuração de nível de banco não vem no dump.** O `pg_dump -Fc` do job não usa
`--create` (o banco é recriado por nome original, o que não combina com restaurar em
paralelo e trocar por rename), então ficam de fora: ACL do banco (ex.: `GRANT CONNECT
ON DATABASE nossagrana_prod TO grafana_ro`), `ALTER DATABASE ... SET`, comentário do
banco e os roles. Antes da troca, reaplique-os ao banco restaurado. Consulte-os no
banco atual (ou nas anotações de quando foram criados):

```bash
kubectl exec -i -n database deploy/postgres -- sh -c 'psql -U "$POSTGRES_USER" -d postgres' <<'SQL'
\l+ nossagrana_prod
SELECT r.rolname, s.setconfig FROM pg_db_role_setting s
  JOIN pg_database d ON d.oid = s.setdatabase
  LEFT JOIN pg_roles r ON r.oid = s.setrole
  WHERE d.datname = 'nossagrana_prod';
SQL
# reaplicar no banco restaurado, por exemplo:
#   GRANT CONNECT ON DATABASE nossagrana_prod_restore TO grafana_ro;
#   ALTER DATABASE nossagrana_prod_restore SET <parametro> = <valor>;
```

Depois seguir os passos 4 a 8 de "Restaurar em produção" (validar, trocar com a API
parada, rollback, apagar `restore.dump` e o artefato locais, registrar). O dump
custom não precisa do `extract-database.sh` (que é só para o `pg_dumpall`).

### Rotação da chave age

1. `age-keygen` novo; atualizar `age-recipient` no Secret `pg-dump-external-storage`.
2. Anotar a data/hora da rotação e **manter a chave privada antiga**: os artefatos
   anteriores só abrem com ela.
3. Rodar um Job manual e restaurar dele com a chave nova.
4. **Só descartar a chave antiga quando nenhum artefato retido depender dela.** Não
   basta esperar 30 dias: a retenção preserva no mínimo 7 artefatos mesmo mais velhos
   (`RETENTION_MIN_KEEP`), então, com o CronJob suspenso ou falhando após a rotação,
   artefatos da chave antiga continuam no destino. Confira que todo `.meta.json` tem
   `created_at` posterior à rotação (`rclone cat <remoto>:<pasta>/<artefato>.meta.json`),
   ou remova/recifre os artefatos antigos antes de apagar a chave.

## Registro de exercícios e incidentes

| Data       | Tipo                 | Artefato                   | Resultado | Duração                | Notas                                                                                                                                          |
| ---------- | -------------------- | -------------------------- | --------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | drill manual #1      | `pg-all-2026-09-22.sql.gz` | falha     | —                      | `stage=restore`: `GRANT CONNECT ON DATABASE nossagrana_prod TO grafana_ro` citava o nome original. Corrigido em `extract-database.sh` + teste. |
| 2026-09-22 | drill manual #2 a #5 | `pg-all-2026-09-22.sql.gz` | sucesso   | Job 12 s (restore 3 s) | 9 migrations, 12 tabelas obrigatórias, `users`/`familias` não vazias. Agendamento diário habilitado após 4 sucessos consecutivos.              |
