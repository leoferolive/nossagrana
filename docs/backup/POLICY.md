# Política de Backup e Restore — NossaGrana

> Issue #45 (epic #44). Versão 1 — 2026-09-22. Dono: Leonardo (operador do cluster).
> Revisar a cada mudança no pipeline de backup ou no mínimo a cada 6 meses.
> Procedimentos operacionais: [RUNBOOK.md](./RUNBOOK.md).

## 1. Onde estão os dados

- Produção usa o **PostgreSQL compartilhado** do cluster: `deploy/postgres` no
  namespace `database` (`postgres.database.svc.cluster.local`, imagem
  `pgvector/pgvector:pg17`), banco `nossagrana_prod`, PVC `postgres-pvc`
  (local-path, disco do nó `elitedesk`).
- `k8s/postgres/statefulset.yaml` deste repositório é **legado** e não é o banco de
  produção (a evidência citada na issue #44 está desatualizada nesse ponto).
- Volume medido em 2026-09-22: dump `pg_dumpall` comprimido de **2,9 MB** para o
  cluster inteiro; restore isolado do `nossagrana_prod` em **3 s**.

## 2. Pipeline de backup

| Etapa                 | CronJob (ns `database`)    | Horário (BRT) | Destino                                                               | Cifragem                                     | Retenção                     | Versionado em                                 |
| --------------------- | -------------------------- | ------------- | --------------------------------------------------------------------- | -------------------------------------------- | ---------------------------- | --------------------------------------------- |
| Dump lógico           | `pg-backup`                | 03:20 diário  | PVC `postgres-backup` (`pg-all-AAAA-MM-DD.sql.gz`)                    | não (mesmo disco do banco)                   | 14 dias                      | `self-workflows` → `cluster/backup`           |
| Restore drill         | `nossagrana-restore-drill` | 03:50 diário  | PostgreSQL descartável (sidecar, emptyDir)                            | n/a                                          | 3 Jobs ok / 3 falhos         | **este repo** → `k8s/backup`                  |
| Cópia local cifrada   | `restic-backup`            | 04:00 diário  | HD USB `/srv/backups/restic/database`                                 | restic (AES-256 + Poly1305)                  | 7 diários, 4 sem., 6 mensais | cluster (fora deste repo)                     |
| Cópia externa cifrada | `restic-backup`            | 04:00 diário  | Google Drive `gdrive:backups/elitedesk-restic-repo` (via rclone)      | restic (AES-256 + Poly1305)                  | 7 diários, 4 sem., 6 mensais | cluster (fora deste repo)                     |
| Dump externo cifrado  | `pg-dump-external`         | 03:35 diário  | Storage externo configurável (rclone), `<banco>-<UTC>-<pod>.dump.age` | age (chave pública no cluster, privada fora) | 30 dias, mínimo 7 artefatos  | **este repo** → `k8s/backup/pg-dump-external` |

Formato: `pg_dumpall` (SQL puro, gzip -9), com roles e todos os bancos do servidor
compartilhado. Timezone de todos os agendamentos: `America/Sao_Paulo` (explícito
nos CronJobs).

O `pg-dump-external` (issue #47) é a cópia **cifrada e verificável por artefato**:
`pg_dump -Fc` só de `nossagrana_prod`, cifrado com [age](https://age-encryption.org)
antes de sair do pod, com `.sha256` e `.meta.json` ao lado, enviado por rclone a um
destino configurável e baixado de volta para conferência antes de o Job ser dado
como sucesso. Nasce **suspenso** (rollout em [RUNBOOK](./RUNBOOK.md#dump-cifrado-externo-pg-dump-external)).
O estado do agendamento é versionado em overlays kustomize (`suspended` para rollout/rollback,
`enabled` para produção): reaplicar os manifests nunca suspende um backup ativo por acidente.
Ele é aditivo: não substitui `pg-backup` nem `restic-backup` até o primeiro
restore a partir dele ser exercitado e registrado.

## 3. RPO/RTO por cenário

| Cenário                                          | Cópia usada            | RPO  | RTO alvo | Observação                                      |
| ------------------------------------------------ | ---------------------- | ---- | -------- | ----------------------------------------------- |
| Erro lógico (DELETE/UPDATE indevido, bug)        | PVC `postgres-backup`  | 24 h | 1 h      | Restaurar em banco paralelo e trocar por rename |
| Perda do pod ou do PVC do Postgres               | PVC `postgres-backup`  | 24 h | 1 h      | Mesmo procedimento                              |
| Perda do disco do nó (PVCs local-path)           | restic no HD USB       | 24 h | 4 h      | Exige reinstalar k3s/Postgres                   |
| Perda do nó/site (furto, incêndio, HD USB junto) | restic no Google Drive | 25 h | 8 h      | Exige hardware novo + segredos fora do cluster  |

- **RPO 24 h** decorre do dump diário. Sem WAL/PITR: tudo entre o último dump e o
  incidente é perdido. PITR só será avaliado se o RPO de 24 h deixar de ser
  aceitável (decisão consciente — o volume e o risco atuais não justificam a
  complexidade no nó único).
- **RTO** medido na restauração isolada: 12 s de Job (3 s de restore). Os alvos
  acima incluem diagnóstico, decisão e troca de banco com a API parada.

## 4. Integridade e checksum

- Diário, automatizado pelo restore drill: seleção do dump mais recente, idade
  ≤ 26 h, tamanho ≥ 10 KB, `gzip -t`, SHA-256 registrado no relatório (e
  conferido contra `<dump>.sha256` quando existir), restore com `ON_ERROR_STOP`
  numa única transação, tabelas obrigatórias, `drizzle.__drizzle_migrations` e
  dados essenciais (`users`, `familias` não vazios).
- restic garante integridade por endereçamento de conteúdo (SHA-256) nas cópias.
- `pg-dump-external`, a cada execução: dump ≥ 10 KB, `pg_restore --list` lê o TOC,
  SHA-256 do artefato **cifrado** gravado em `<artefato>.sha256`, upload sem
  sobrescrita (checagem prévia + `--ignore-existing`), download dos três objetos e
  comparação byte a byte, `sha256sum -c`. Qualquer falha de conexão, dump,
  cifragem, upload ou verificação termina o Job com erro (alerta
  `NossaGranaBackupJobNotSucceeded`). Execuções concorrentes são impedidas
  (`concurrencyPolicy: Forbid`) e o nome inclui timestamp UTC + nome do pod. O
  `.meta.json` só sobe depois de artefato e `.sha256` verificados: artefato sem
  `.meta.json` é órfão, não conta para o mínimo de 7 da retenção e expira em 30 dias.

## 5. Segredos e chaves

- Credenciais do Postgres: Secret `postgres-secret` (ns `database`) — o restore
  drill **não** o recebe.
- Chave restic e `rclone.conf`: Secret `restic-backup-secrets` (ns `database`).
- `pg-dump-external`: Secret `pg-dump-external-db` (role `backup_ro`, somente
  leitura só em `nossagrana_prod` via `grant-backup-ro.sql`, sem `pg_read_all_data`
  nem superusuário) e Secret
  `pg-dump-external-storage` (`rclone.conf`, `remote`, `age-recipient`). Nenhum
  valor é versionado; o CronJob só referencia os Secrets por nome.
- **Chave privada age**: fica **fora do cluster** (gerenciador de senhas do dono).
  O cluster só recebe a chave pública (`age1...`), então quem lê o storage ou o
  Secret não decifra os dumps — e, ao mesmo tempo, **sem a chave privada os
  artefatos do `pg-dump-external` são irrecuperáveis**. Verificar a cada revisão.
- **Obrigatório**: senha do repositório restic e `rclone.conf` guardados **fora do
  cluster** (gerenciador de senhas do dono). Sem eles a cópia no Google Drive é
  irrecuperável na perda do nó. Verificar a cada revisão desta política.
- Rotação da chave restic:
  1. `restic key add`;
  2. atualizar o Secret;
  3. `restic key remove <id-antigo>` — só depois de validar um restore com a nova.
- Nenhum segredo, dado pessoal ou financeiro vai para logs: o drill emite só
  nomes de artefato, hashes, tamanhos e **contagens** de linhas.

## 6. Monitoramento e resposta

Alertas em `k8s/backup/prometheusrule-backup.yaml` (Prometheus do kps →
Alertmanager → Telegram):

| Alerta                             | Condição                                                                                                           | Severidade |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------- |
| `NossaGranaBackupStale`            | `pg-backup`, `restic-backup` ou `pg-dump-external` sem sucesso há > 26 h (RPO), ou nunca agendado 26 h após criado | critical   |
| `NossaGranaBackupJobNotSucceeded`  | último agendamento sem sucesso 1 h depois, ou nunca teve sucesso (ignora suspensos)                                | critical   |
| `NossaGranaRestoreDrillStale`      | nenhum restore comprovado há > 26 h                                                                                | critical   |
| `NossaGranaBackupCronJobMissing`   | algum dos quatro CronJobs deixou de existir                                                                        | critical   |
| `NossaGranaBackupCronJobSuspended` | algum dos quatro CronJobs com `spec.suspend=true` há > 24 h (o `Stale` ignora só o `pg-dump-external` suspenso)    | warning    |
| `NossaGranaBackupDiskLow`          | < 10 % livre em `/` (PVCs) ou `/srv/backups` (restic local)                                                        | warning    |

Violação de RPO/RTO: tratar como incidente — seguir o runbook, registrar data,
causa e duração na seção "Registro de exercícios e incidentes" do runbook.

## 7. Exceções e limitações conhecidas

- O restore drill valida a cópia **local** (PVC). A cópia externa (Google Drive)
  depende do `restic backup` sem `restic check --read-data-subset` periódico nem
  restore automatizado a partir dela — próximo passo recomendado.
- O restore drill diário ainda valida só o dump local (`pg_dumpall` do PVC). O
  artefato do `pg-dump-external` é verificado no upload (integridade e TOC), mas
  o restore completo a partir dele é manual (runbook) até um drill dedicado —
  próximo passo natural, exige a chave privada fora do cluster.
- O dump do `pg-dump-external` não inclui configuração de nível de banco (ACL do
  banco, `ALTER DATABASE ... SET`) nem roles: ao restaurar, reaplicá-los (passo no
  [RUNBOOK](./RUNBOOK.md#restaurar-a-partir-do-dump-externo)). O `pg_dumpall` local
  os inclui.
- Os dumps no PVC `postgres-backup` não são cifrados em repouso; estão no mesmo
  disco e sob o mesmo controle de acesso do próprio banco.
- A NetworkPolicy do drill não é aplicada no cluster atual (controller de
  NetworkPolicy do k3s inativo); o isolamento efetivo vem da ausência de
  credenciais e do `PGHOST=127.0.0.1` (ver `k8s/backup/tests/manifests.test.sh`).
- Retenção destrutiva (14 dias no PVC, `forget --prune` no restic) já está ativa
  e é gerida no repositório do cluster.
