-- Nova UI, Entrega 3, PR 1 (docs/superpowers/specs/2026-11-16-nova-ui-entrega-3-design.md):
-- editar o limite de uma categoria no mesmo mês em que ele começou encerrava a
-- linha aberta (com início e fim iguais) e inseria outra, então a lista do mês
-- mostrava dois limites da mesma categoria. O código agora atualiza o valor no
-- lugar; esta migration trata as duplicatas já gravadas e impede que voltem.
-- Escrita à mão sobre o SQL do drizzle-kit, no mesmo padrão da 0012:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations), numa transação única do migrator; se a tabela estiver
--     travada, falha rápido e o pod tenta de novo. SET LOCAL vale só nela.
--   - LOCK ... SHARE ROW EXCLUSIVE no início (dentro de DO, porque o LOCK só vale
--     em bloco de transação e o restore drill aplica cada .sql via psql em
--     autocommit): impede uma escrita concorrente entre mover as duplicatas e
--     criar o índice. Leituras (inclusive o pg_dump do backup) não são
--     bloqueadas.
--   - deduplicação NÃO destrutiva: só duplicata exata (mesma família, categoria e
--     "vigencia_inicio"). A linha mais recente ("criado_em"; empate pelo maior
--     id) permanece intacta; as demais são MOVIDAS para
--     "orcamento_categoria_duplicados" (DELETE ... RETURNING + INSERT na mesma
--     instrução), com todos os valores e mais "movido_em". Limites de outras
--     vigências, categorias e famílias não são lidos como duplicata nem
--     alterados, então o histórico de meses anteriores fica intacto.
--   - a linha mantida é a última edição, que é a que vale hoje.
--   - o índice único impede a duplicata de voltar; se ainda sobrar uma, a
--     criação falha com 23505 e a transação inteira é revertida (sem estado
--     parcial).
--   - pode rodar duas vezes: CREATE ... IF NOT EXISTS, e depois da primeira não
--     sobra grupo com mais de uma linha.
--   - para desfazer: DROP INDEX "orcamento_categoria_vigencia_uq" e reinserir em
--     "orcamento_categoria" as linhas de "orcamento_categoria_duplicados"
--     (mesmas colunas, menos "movido_em"); depois, se quiser, apagar a tabela de
--     auditoria.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DO $$
BEGIN
  LOCK TABLE "orcamento_categoria" IN SHARE ROW EXCLUSIVE MODE;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orcamento_categoria_duplicados" (
	"id" uuid PRIMARY KEY NOT NULL,
	"familia_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"valor_limite" numeric(14, 2) NOT NULL,
	"vigencia_inicio" text NOT NULL,
	"vigencia_fim" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"movido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
WITH ranqueados AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "familia_id", "categoria_id", "vigencia_inicio"
		ORDER BY "criado_em" DESC, "id" DESC
	) AS posicao
	FROM "orcamento_categoria"
), removidos AS (
	DELETE FROM "orcamento_categoria" o
	USING "ranqueados" r
	WHERE o."id" = r."id" AND r.posicao > 1
	RETURNING o."id", o."familia_id", o."categoria_id", o."valor_limite", o."vigencia_inicio",
		o."vigencia_fim", o."criado_por", o."criado_em"
)
INSERT INTO "orcamento_categoria_duplicados" ("id", "familia_id", "categoria_id", "valor_limite",
	"vigencia_inicio", "vigencia_fim", "criado_por", "criado_em")
SELECT "id", "familia_id", "categoria_id", "valor_limite", "vigencia_inicio", "vigencia_fim",
	"criado_por", "criado_em" FROM "removidos";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orcamento_categoria_vigencia_uq" ON "orcamento_categoria" USING btree ("familia_id","categoria_id","vigencia_inicio");
