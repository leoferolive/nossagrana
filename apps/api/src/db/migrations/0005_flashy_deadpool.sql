CREATE INDEX "orcamento_categoria_familia_categoria_idx" ON "orcamento_categoria" USING btree ("familia_id","categoria_id");--> statement-breakpoint
CREATE INDEX "snapshots_mensais_familia_mes_idx" ON "snapshots_mensais" USING btree ("familia_id","mes_referencia");--> statement-breakpoint
CREATE INDEX "transacoes_categoria_id_idx" ON "transacoes" USING btree ("categoria_id");--> statement-breakpoint
CREATE INDEX "transacoes_metodo_pagamento_id_idx" ON "transacoes" USING btree ("metodo_pagamento_id");--> statement-breakpoint
CREATE INDEX "transacoes_transacao_pai_id_idx" ON "transacoes" USING btree ("transacao_pai_id");