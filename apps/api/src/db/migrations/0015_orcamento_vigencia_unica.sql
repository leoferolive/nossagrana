-- Nova UI, Entrega 3, PR 1 (docs/superpowers/specs/2026-11-16-nova-ui-entrega-3-design.md):
-- editar o limite de uma categoria no mesmo mês em que ele começou encerrava a
-- linha aberta (com início e fim iguais) e inserindo outra, então a lista do
-- mês mostrava dois limites da mesma categoria. O código agora atualiza o valor
-- no lugar; esta migration de dados remove as duplicatas já gravadas. Escrita à
-- mão (drizzle-kit generate --custom), no padrão da 0013:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations), numa transação única do migrator; se as linhas estiverem
--     travadas, falha rápido e o pod tenta de novo. SET LOCAL vale só nela.
--   - só toca duplicata exata: mesma família, mesma categoria e mesmo
--     "vigencia_inicio". Mantém a linha mais recente ("criado_em", com "id"
--     como desempate) e remove as demais. Limites de outras vigências, de outras
--     categorias e de outras famílias não são lidos nem alterados, então o
--     histórico de meses anteriores continua intacto.
--   - a linha mantida é a que vale hoje (a última edição); o "vigencia_fim"
--     dela já cobre o período certo, então nenhum mês fica sem limite.
--   - pode rodar duas vezes: depois da primeira não sobra grupo com mais de uma
--     linha, e o DELETE seguinte não encontra nada.
--   - não reversível (as linhas removidas eram só valores intermediários da
--     mesma vigência); para recuperar, restaurar o backup do PostgreSQL.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DELETE FROM "orcamento_categoria"
 WHERE "id" IN (
   SELECT "id"
     FROM (
       SELECT "id",
              ROW_NUMBER() OVER (
                PARTITION BY "familia_id", "categoria_id", "vigencia_inicio"
                ORDER BY "criado_em" DESC, "id" DESC
              ) AS "posicao"
         FROM "orcamento_categoria"
     ) AS "ordenadas"
    WHERE "posicao" > 1
 );
