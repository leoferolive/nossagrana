CREATE TYPE "public"."cofrinho_status" AS ENUM('ativo', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."movimentacao_cofrinho_tipo" AS ENUM('aporte', 'retirada');--> statement-breakpoint
CREATE TABLE "cofrinhos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"emoji" text,
	"descricao" text,
	"meta_valor" numeric(12, 2),
	"saldo_atual" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "cofrinho_status" DEFAULT 'ativo' NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "movimentacoes_cofrinho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cofrinho_id" uuid NOT NULL,
	"familia_id" uuid NOT NULL,
	"tipo" "movimentacao_cofrinho_tipo" NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"descricao" text,
	"transacao_id" uuid,
	"registrado_por" uuid NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"mes_referencia" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorias" ADD COLUMN "sistema" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transacoes" ADD COLUMN "cofrinho_id" uuid;--> statement-breakpoint
ALTER TABLE "cofrinhos" ADD CONSTRAINT "cofrinhos_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cofrinhos" ADD CONSTRAINT "cofrinhos_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" ADD CONSTRAINT "movimentacoes_cofrinho_cofrinho_id_cofrinhos_id_fk" FOREIGN KEY ("cofrinho_id") REFERENCES "public"."cofrinhos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" ADD CONSTRAINT "movimentacoes_cofrinho_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" ADD CONSTRAINT "movimentacoes_cofrinho_transacao_id_transacoes_id_fk" FOREIGN KEY ("transacao_id") REFERENCES "public"."transacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentacoes_cofrinho" ADD CONSTRAINT "movimentacoes_cofrinho_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cofrinhos_familia_id_idx" ON "cofrinhos" USING btree ("familia_id");--> statement-breakpoint
CREATE INDEX "movimentacoes_cofrinho_cofrinho_id_idx" ON "movimentacoes_cofrinho" USING btree ("cofrinho_id");--> statement-breakpoint
CREATE INDEX "movimentacoes_cofrinho_familia_id_idx" ON "movimentacoes_cofrinho" USING btree ("familia_id");