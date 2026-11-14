-- Issue #69 (epic #50): um snapshot por (familia_id, mes_referencia). Gerada
-- pelo drizzle-kit e revisada à mão, no mesmo padrão da 0009/0011:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations), numa transação única do migrator; se a tabela estiver
--     travada, falha rápido e o pod tenta de novo. SET LOCAL vale só nela.
--   - LOCK ... ACCESS EXCLUSIVE logo no início (mesmo padrão da 0010): o
--     DROP INDEX exige ACCESS EXCLUSIVE; pegar um lock menor primeiro e elevá-lo
--     no meio da transação abre espaço para deadlock/espera. O deploy é
--     `Recreate` com 1 réplica (sem pod antigo concorrente); os concorrentes
--     reais são o backup (pg_dump segura ACCESS SHARE) ou uma sessão externa:
--     nesse caso o lock_timeout falha a migration em 5s, sem estado parcial.
--   - deduplicação NÃO destrutiva: o canônico é o mais antigo (menor
--     gerado_em; empate pelo menor id) e permanece intacto — snapshot original
--     nunca é recalculado nem alterado. As demais linhas são MOVIDAS para
--     "snapshots_mensais_duplicados" (DELETE ... RETURNING + INSERT na mesma
--     instrução), nunca simplesmente apagadas.
--   - se ainda sobrar duplicata, o CREATE UNIQUE INDEX falha com 23505 e a
--     transação inteira é revertida (sem estado parcial).
--   - o índice composto não único antigo é removido: o único o substitui.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
LOCK TABLE "snapshots_mensais" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
CREATE TABLE "snapshots_mensais_duplicados" (
	"id" uuid PRIMARY KEY NOT NULL,
	"familia_id" uuid NOT NULL,
	"mes_referencia" text NOT NULL,
	"total_receitas" numeric(14, 2) NOT NULL,
	"total_despesas" numeric(14, 2) NOT NULL,
	"saldo" numeric(14, 2) NOT NULL,
	"dados_categorias" jsonb NOT NULL,
	"dados_usuarios" jsonb NOT NULL,
	"divergente" boolean NOT NULL,
	"gerado_em" timestamp with time zone NOT NULL,
	"movido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
WITH ranqueados AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "familia_id", "mes_referencia" ORDER BY "gerado_em" ASC, "id" ASC
	) AS posicao
	FROM "snapshots_mensais"
), removidos AS (
	DELETE FROM "snapshots_mensais" s
	USING "ranqueados" r
	WHERE s."id" = r."id" AND r.posicao > 1
	RETURNING s."id", s."familia_id", s."mes_referencia", s."total_receitas", s."total_despesas",
		s."saldo", s."dados_categorias", s."dados_usuarios", s."divergente", s."gerado_em"
)
INSERT INTO "snapshots_mensais_duplicados" ("id", "familia_id", "mes_referencia", "total_receitas",
	"total_despesas", "saldo", "dados_categorias", "dados_usuarios", "divergente", "gerado_em")
SELECT "id", "familia_id", "mes_referencia", "total_receitas", "total_despesas", "saldo",
	"dados_categorias", "dados_usuarios", "divergente", "gerado_em" FROM "removidos";
--> statement-breakpoint
DROP INDEX "snapshots_mensais_familia_mes_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_mensais_familia_mes_uq" ON "snapshots_mensais" USING btree ("familia_id","mes_referencia");
