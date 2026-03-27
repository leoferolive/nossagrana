CREATE TABLE "templates_transacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "transacao_tipo" NOT NULL,
	"categoria_id" uuid,
	"metodo_pagamento_id" uuid,
	"cofrinho_id" uuid,
	"ordem" integer DEFAULT 0 NOT NULL,
	"valor_padrao" numeric(14, 2),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_metodo_pagamento_id_metodos_pagamento_id_fk" FOREIGN KEY ("metodo_pagamento_id") REFERENCES "public"."metodos_pagamento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_cofrinho_id_cofrinhos_id_fk" FOREIGN KEY ("cofrinho_id") REFERENCES "public"."cofrinhos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_transacao" ADD CONSTRAINT "templates_transacao_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_templates_transacao_familia_id" ON "templates_transacao" USING btree ("familia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_templates_transacao_familia_nome_tipo" ON "templates_transacao" USING btree ("familia_id","nome","tipo") WHERE "templates_transacao"."ativo" = $1;