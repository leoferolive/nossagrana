-- Issue #90 (epic #64): chaves de idempotência das operações financeiras
-- (POST /transacoes, aportes, retiradas e aplicar templates). Gerada pelo
-- drizzle-kit e revisada à mão, no mesmo padrão da 0009/0010:
--   - lock_timeout: em produção a migration roda no startup do pod
--     (runMigrations). A FK para "familias" pede SHARE ROW EXCLUSIVE em
--     "familias"; se outro processo segurar lock nela, falha rápido e o pod
--     tenta de novo. SET LOCAL vale só para a transação única do migrator.
--   - sem pré-checagem de dados: a tabela é nova e nenhuma linha existente é
--     validada ou alterada — só "familias" é referenciada, e a FK nasce sobre
--     uma tabela vazia. O teste *.pg.test.ts aplica a 0011 sobre dados legados.
--   - PK (familia_id, chave): é o índice único em que uma requisição
--     concorrente com a mesma chave espera o commit/rollback da primeira.
--   - ON DELETE CASCADE: chave de idempotência é cache de resposta com
--     validade de 24h; não pode impedir a remoção física de uma família.
--   - CHECK: status/resposta andam juntos e só respostas 2xx são gravadas.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE "chaves_idempotencia" (
	"familia_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"operacao" text NOT NULL,
	"hash_payload" text NOT NULL,
	"status_code" integer,
	"resposta" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chaves_idempotencia_pk" PRIMARY KEY("familia_id","chave"),
	CONSTRAINT "chaves_idempotencia_resposta_2xx" CHECK (("chaves_idempotencia"."status_code" IS NULL AND "chaves_idempotencia"."resposta" IS NULL) OR ("chaves_idempotencia"."status_code" BETWEEN 200 AND 299 AND "chaves_idempotencia"."resposta" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "chaves_idempotencia" ADD CONSTRAINT "chaves_idempotencia_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chaves_idempotencia_criado_em" ON "chaves_idempotencia" USING btree ("criado_em");