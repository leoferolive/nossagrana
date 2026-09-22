#!/bin/sh
# Extrai um banco de um pg_dumpall (.sql.gz) como SQL restaurável em outro
# banco. Usado pelo restore drill e pelo restore manual (docs/backup/RUNBOOK.md).
#
# Uso: extract-database.sh <dump.sql.gz> <banco_origem> <banco_destino> > banco.sql
# Exit 2 se <banco_origem> não estiver no dump.
#
# Seção do banco no pg_dumpall: tudo após o primeiro `\connect <db>` até o
# marcador "-- PostgreSQL database dump complete" (+ o `\unrestrict` que o
# segue no PG >= 17.6). Com `ALTER DATABASE ... SET` o pg_dumpall emite dois
# blocos `\connect <db>` (propriedades e conteúdo) — ambos entram, e os
# `\connect` repetidos são omitidos para o psql continuar no banco destino.
#
# DDL de nível de banco cita o nome original (ex.: `GRANT CONNECT ON DATABASE
# nossagrana_prod TO grafana_ro`, achado no 1º drill em produção) e é
# redirecionado ao destino — nunca dentro de blocos COPY (dados).
set -eu

[ "$#" -eq 3 ] || {
  echo "uso: $0 <dump.sql.gz> <banco_origem> <banco_destino>" >&2
  exit 64
}

gzip -dc "$1" | awk -v db="$2" -v target="$3" '
  $0 == "\\connect " db { found = 1; next }
  !found { next }
  complete && /^\\unrestrict / { print; exit }
  complete && !/^(--.*)?$/ { exit }
  $0 == "-- PostgreSQL database dump complete" { complete = 1 }
  /^\\connect / { exit }
  in_copy && $0 == "\\." { in_copy = 0 }
  !in_copy && /^COPY .* FROM stdin;$/ { in_copy = 1 }
  !in_copy {
    gsub("DATABASE " db " ", "DATABASE " target " ")
    gsub("DATABASE " db ";", "DATABASE " target ";")
  }
  { print }
  END { if (!found) exit 2 }
'
