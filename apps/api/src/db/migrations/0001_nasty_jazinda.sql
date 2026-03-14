CREATE TYPE "public"."categoria_tipo" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TYPE "public"."metodo_pagamento_tipo" AS ENUM('credito', 'debito', 'pix', 'dinheiro');--> statement-breakpoint
CREATE TYPE "public"."solicitacao_entrada_status" AS ENUM('pendente', 'aprovada', 'rejeitada');--> statement-breakpoint
CREATE TYPE "public"."transacao_frequencia" AS ENUM('mensal', 'semanal', 'quinzenal');--> statement-breakpoint
CREATE TYPE "public"."transacao_tipo" AS ENUM('receita', 'despesa');--> statement-breakpoint
CREATE TYPE "public"."usuario_familia_role" AS ENUM('admin', 'membro');--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "categoria_tipo" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "convites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"criado_por" uuid NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_por" uuid,
	"usado_em" timestamp with time zone,
	"data_criacao" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "convites_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "familias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"data_criacao" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metodos_pagamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"tipo" "metodo_pagamento_tipo" NOT NULL,
	"data_fechamento" integer,
	"data_vencimento" integer,
	"usuario_dono_id" uuid NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orcamento_categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"categoria_id" uuid NOT NULL,
	"valor_limite" numeric(14, 2) NOT NULL,
	"vigencia_inicio" text NOT NULL,
	"vigencia_fim" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots_mensais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"mes_referencia" text NOT NULL,
	"total_receitas" numeric(14, 2) NOT NULL,
	"total_despesas" numeric(14, 2) NOT NULL,
	"saldo" numeric(14, 2) NOT NULL,
	"dados_categorias" jsonb NOT NULL,
	"dados_usuarios" jsonb NOT NULL,
	"divergente" boolean DEFAULT false NOT NULL,
	"gerado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitacoes_entrada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"status" "solicitacao_entrada_status" DEFAULT 'pendente' NOT NULL,
	"solicitado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"respondido_em" timestamp with time zone,
	"respondido_por" uuid
);
--> statement-breakpoint
CREATE TABLE "transacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"tipo" "transacao_tipo" NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"categoria_id" uuid NOT NULL,
	"descricao" text,
	"data" date NOT NULL,
	"mes_referencia" text NOT NULL,
	"metodo_pagamento_id" uuid,
	"usuario_registrou_id" uuid NOT NULL,
	"recorrente" boolean DEFAULT false NOT NULL,
	"frequencia" "transacao_frequencia",
	"data_fim_recorrencia" date,
	"parcelado" boolean DEFAULT false NOT NULL,
	"numero_parcelas" integer,
	"parcela_atual" integer,
	"valor_total" numeric(14, 2),
	"valor_parcela" numeric(14, 2),
	"transacao_pai_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"data_criacao" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usuario_familia" (
	"usuario_id" uuid NOT NULL,
	"familia_id" uuid NOT NULL,
	"role" "usuario_familia_role" DEFAULT 'membro' NOT NULL,
	"data_entrada" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_familia_usuario_id_familia_id_pk" PRIMARY KEY("usuario_id","familia_id")
);
--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convites" ADD CONSTRAINT "convites_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convites" ADD CONSTRAINT "convites_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convites" ADD CONSTRAINT "convites_usado_por_users_id_fk" FOREIGN KEY ("usado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pagamento" ADD CONSTRAINT "metodos_pagamento_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metodos_pagamento" ADD CONSTRAINT "metodos_pagamento_usuario_dono_id_users_id_fk" FOREIGN KEY ("usuario_dono_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "orcamento_categoria_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "orcamento_categoria_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orcamento_categoria" ADD CONSTRAINT "orcamento_categoria_criado_por_users_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots_mensais" ADD CONSTRAINT "snapshots_mensais_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_entrada" ADD CONSTRAINT "solicitacoes_entrada_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_entrada" ADD CONSTRAINT "solicitacoes_entrada_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_entrada" ADD CONSTRAINT "solicitacoes_entrada_respondido_por_users_id_fk" FOREIGN KEY ("respondido_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_metodo_pagamento_id_metodos_pagamento_id_fk" FOREIGN KEY ("metodo_pagamento_id") REFERENCES "public"."metodos_pagamento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_usuario_registrou_id_users_id_fk" FOREIGN KEY ("usuario_registrou_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_familia" ADD CONSTRAINT "usuario_familia_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_familia" ADD CONSTRAINT "usuario_familia_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshots_mensais_familia_id_idx" ON "snapshots_mensais" USING btree ("familia_id");--> statement-breakpoint
CREATE INDEX "snapshots_mensais_mes_referencia_idx" ON "snapshots_mensais" USING btree ("mes_referencia");--> statement-breakpoint
CREATE INDEX "transacoes_familia_id_idx" ON "transacoes" USING btree ("familia_id");--> statement-breakpoint
CREATE INDEX "transacoes_mes_referencia_idx" ON "transacoes" USING btree ("mes_referencia");--> statement-breakpoint
CREATE INDEX "transacoes_usuario_registrou_id_idx" ON "transacoes" USING btree ("usuario_registrou_id");