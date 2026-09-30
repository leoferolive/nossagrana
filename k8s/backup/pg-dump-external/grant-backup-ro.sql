-- Permissões do role `backup_ro` (issue #47), SÓ dentro de nossagrana_prod.
--
-- Não usar `pg_read_all_data`: é um role predefinido do CLUSTER e daria leitura
-- de todos os bancos do PostgreSQL compartilhado a quem obtivesse o Secret
-- `pg-dump-external-db` (Codex P1, PR #143). Aqui o role lê apenas o banco da
-- aplicação; o CONNECT que o PUBLIC tem em outros bancos não concede SELECT em
-- nenhuma tabela deles.
--
-- Executar como superusuário, conectado ao banco da aplicação (o passo a passo
-- em docs/backup/RUNBOOK.md cria o role antes):
--   psql -d nossagrana_prod -v ON_ERROR_STOP=1 -f grant-backup-ro.sql
-- Idempotente. `drizzle` é o schema das migrations; `public` o da aplicação.
GRANT CONNECT ON DATABASE nossagrana_prod TO backup_ro;
GRANT USAGE ON SCHEMA public, drizzle TO backup_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO backup_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO backup_ro;

-- Tabelas/sequences criadas depois (migrations rodam como nossagrana_prod).
ALTER DEFAULT PRIVILEGES FOR ROLE nossagrana_prod IN SCHEMA public, drizzle
  GRANT SELECT ON TABLES TO backup_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE nossagrana_prod IN SCHEMA public, drizzle
  GRANT SELECT ON SEQUENCES TO backup_ro;
