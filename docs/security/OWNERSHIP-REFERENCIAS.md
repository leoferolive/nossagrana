# Ownership de Referências Financeiras

> Issue #55 (epic #54). Revisado em 2026-09-22.
> Implementação: `apps/api/src/shared/referencia-ownership/`.

Toda referência a outro registro recebida do cliente (ou lida de um registro
gravado) precisa pertencer à **mesma `familia_id`** da operação. Filtrar a
query principal por família não basta: um `categoriaId` de outra família seria
gravado e depois exposto por joins (ex.: `categoriaNome` nos templates).

## Contrato

- `ReferenciaOwnershipValidator.validar({ familiaId, categoria?, metodoPagamento?, cofrinho? })`
  roda **antes de qualquer escrita** e lança `ReferenciaInvalidaError` →
  HTTP **422** no envelope de `api-design.md`:
  `{ error: { message, code: 'REFERENCIA_INVALIDA' } }` (handler central em
  `referencia-ownership.http.ts`, declarado no schema de resposta das rotas).
- ID de outra família e ID inexistente têm **a mesma resposta** (`nao_encontrada`);
  a mensagem ecoa só o ID recebido e a família do próprio usuário.
- `referenciaEsperada(id, idAtual)`: vínculo **novo ou alterado** exige registro
  ativo; o **mesmo vínculo já gravado** pode estar inativo.
- Categoria com `tipo` informado precisa ter o mesmo tipo do lançamento.

## Matriz

| Operação                            | Referência                | Regra                                                                                                  |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `POST /transacoes`                  | `categoriaId`             | da família, ativa, tipo = tipo da transação                                                            |
|                                     | `metodoPagamentoId`       | da família, ativo                                                                                      |
|                                     | `cofrinhoId` (interno)    | da família, ativo                                                                                      |
| `PATCH /transacoes/:id`             | `categoriaId`             | da família, tipo igual; ativa só se trocou                                                             |
|                                     | `metodoPagamentoId`       | da família; ativo só se trocou                                                                         |
| `POST /orcamento/:categoriaId`      | `categoriaId`             | da família; ativa se não houver orçamento vigente                                                      |
| `POST /templates-transacao`         | categoria/método/cofrinho | da família, ativos; categoria com tipo do template                                                     |
| `PATCH /templates-transacao/:id`    | categoria/método/cofrinho | da família; ativos só se trocaram; `null` remove o vínculo                                             |
| `POST /templates-transacao/aplicar` | vínculos gravados         | da família; categoria pode estar inativa, método e cofrinho ativos (#57); valida todos antes de gravar |

Sem mudança necessária (já restritos à família ou definidos no servidor):

| Caminho                                            | Por quê                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `usuarioRegistrouId`, `criadoPor`, `registradoPor` | vêm do JWT (`request.user.sub`), membro validado por `requireFamiliaScope` |
| `transacaoPaiId`, antecipação                      | gerados pelo servidor; busca por `id` + `familiaId`                        |
| Aporte/retirada de cofrinho (`/cofrinhos/:id`)     | `CofrinhoService` busca o cofrinho por `id` + `familiaId`                  |
| Categoria "Cofrinho" dos aportes                   | resolvida no servidor por `familiaId` + `sistema = true`                   |
| Update/delete de categoria e método                | o próprio registro, buscado por `id` + `familiaId`                         |
| Filtros de listagem (`categoriaId` etc.)           | leitura já restrita à família; ID alheio só retorna vazio                  |

## Diagnóstico de dados legados

`apps/api/src/db/diagnostics/ownership-referencias.sql` (somente leitura,
retorna só contagens). Resultado em 2026-09-22:

| Banco             | Referências de outra família | Órfãs | Observação                                           |
| ----------------- | ---------------------------- | ----- | ---------------------------------------------------- |
| `nossagrana_prod` | 0                            | 0     | 19/19 templates apontam para **categorias inativas** |
| `nossagrana_dev`  | 0                            | 0     | —                                                    |

Os templates com categoria inativa motivaram a regra "vínculo gravado pode ser
inativo": exigir categoria ativa em `aplicar` quebraria todos os templates da
família em produção. A exceção vale só para a categoria: em `aplicar`, método de
pagamento e cofrinho gravados precisam estar ativos (#57), senão um cofrinho
encerrado faria o aporte falhar no meio do loop (gravação parcial) e um método
inativo geraria lançamento num método desativado.

## Constraints no banco (#58)

Defesa em profundidade: mesmo que a validação do service seja contornada
(outro caminho de escrita, corrida, script manual), o PostgreSQL rejeita a
referência de outra família. Migration:
`apps/api/src/db/migrations/0009_familia_fk_compostas.sql`.

- **Uniques** `(id, familia_id)` (alvo das FKs): `categorias_id_familia_id_unique`,
  `metodos_pagamento_id_familia_id_unique`, `cofrinhos_id_familia_id_unique`,
  `transacoes_id_familia_id_unique`.
- **FKs compostas** `(<ref>_id, familia_id) → <alvo>(id, familia_id)`, `MATCH SIMPLE`
  (coluna de referência `NULL` não é checada, então as colunas anuláveis continuam
  anuláveis):

| Constraint                                        | Coluna                                    | Alvo                | ON DELETE                     |
| ------------------------------------------------- | ----------------------------------------- | ------------------- | ----------------------------- |
| `transacoes_categoria_familia_fk`                 | `transacoes.categoria_id`                 | `categorias`        | NO ACTION                     |
| `transacoes_metodo_pagamento_familia_fk`          | `transacoes.metodo_pagamento_id`          | `metodos_pagamento` | NO ACTION                     |
| `transacoes_cofrinho_familia_fk`                  | `transacoes.cofrinho_id`                  | `cofrinhos`         | NO ACTION (não tinha FK)      |
| `transacoes_transacao_pai_familia_fk`             | `transacoes.transacao_pai_id`             | `transacoes`        | SET NULL (`transacao_pai_id`) |
| `orcamento_categoria_categoria_familia_fk`        | `orcamento_categoria.categoria_id`        | `categorias`        | NO ACTION                     |
| `templates_transacao_categoria_familia_fk`        | `templates_transacao.categoria_id`        | `categorias`        | NO ACTION                     |
| `templates_transacao_metodo_pagamento_familia_fk` | `templates_transacao.metodo_pagamento_id` | `metodos_pagamento` | NO ACTION                     |
| `templates_transacao_cofrinho_familia_fk`         | `templates_transacao.cofrinho_id`         | `cofrinhos`         | NO ACTION                     |
| `movimentacoes_cofrinho_cofrinho_familia_fk`      | `movimentacoes_cofrinho.cofrinho_id`      | `cofrinhos`         | NO ACTION                     |
| `movimentacoes_cofrinho_transacao_familia_fk`     | `movimentacoes_cofrinho.transacao_id`     | `transacoes`        | NO ACTION                     |

Decisões:

- **FKs simples removidas.** Com `familia_id NOT NULL`, a composta já garante que
  o ID existe; manter as duas só duplicaria checagem e nome de erro. As FKs
  `<tabela>_familia_id_familias_id_fk` (para `familias`) continuam.
- **ON DELETE preservado.** Todas as FKs antigas eram `NO ACTION`; categorias,
  métodos e cofrinhos nunca são apagados pela aplicação (só desativados/encerrados).
- **`transacao_pai_id` → `SET NULL ("transacao_pai_id")`.** `DELETE /transacoes/:id`
  apaga só a linha pedida; se for a transação pai de parcelas/recorrência, as
  filhas continuavam existindo com um `transacao_pai_id` pendente. `NO ACTION`
  passaria a bloquear essa exclusão (regressão) e `CASCADE` apagaria as filhas;
  `SET NULL` restrito à coluna mantém a exclusão e só desvincula as filhas (sem
  a lista de colunas, o PostgreSQL anularia também `familia_id`). Requer PG ≥ 15.
- **Transação com movimentação de cofrinho** continua sem poder ser apagada
  (`NO ACTION`, como antes).
- **Órfãs de `transacao_pai_id` são normalizadas pela própria migration.** Até o
  deploy, excluir o pai continua deixando filhas com `transacao_pai_id` apontando
  para linha inexistente (0 em 2026-09-22, mas pode surgir a qualquer momento).
  Antes da pré-checagem, a 0009 faz `SET transacao_pai_id = NULL` só nessas
  órfãs verdadeiras (pai inexistente em qualquer família) — o mesmo efeito do
  novo `ON DELETE SET NULL`. Pai de **outra família** não é órfão: continua
  abortando a migration. Sem isso, uma única exclusão de pai antes do deploy
  faria a pré-checagem abortar e o pod entrar em crash-loop.
- **`SET LOCAL lock_timeout = '5s'`** no topo: se o pod antigo segurar lock nas
  tabelas, a migration falha rápido (SQLSTATE `55P03`, nada alterado) e o pod
  reinicia e tenta de novo, em vez de ficar parado na fila de locks bloqueando
  também as queries da aplicação.

### Erro na API

`registrarRespostaReferenciaInvalida` passa o erro por
`traduzirViolacaoReferencia` (`referencia-ownership.db-error.ts`): violação
(SQLSTATE `23503`) de uma das FKs acima num `INSERT`/`UPDATE` vira
`ReferenciaInvalidaError` → **422** `{ error: { message, code: 'REFERENCIA_INVALIDA' } }`,
com mensagem genérica (sem SQL, nome de constraint nem IDs). A mesma
constraint violada por `DELETE` (registro ainda referenciado) e FKs fora da
lista seguem o caminho de erro atual.

### Aplicar em um ambiente

Em produção a migration **não** roda via drizzle-kit: roda no startup do pod da
API (`runMigrations` em `apps/api/src/server.ts`, migrator do `drizzle-orm`,
uma transação para todas as pendentes). Se falhar, o processo sai com código 1
e o pod reinicia (crash-loop até o dado ser corrigido ou a imagem revertida).
`pnpm --filter api db:migrate` (drizzle-kit) é o caminho para dev/bancos
descartáveis.

1. Fazer o deploy em **horário de pouco uso** (menos escrita concorrente e
   menos chance de esbarrar no `lock_timeout`).
2. **Logo antes do deploy**, rodar a pré-checagem somente leitura
   `apps/api/src/db/diagnostics/ownership-referencias.sql`: `outra_familia` deve
   estar zerado em tudo e `orfa` zerado fora de `transacoes.transacao_pai_id`
   (essas órfãs a migration desvincula sozinha); `inativa`/`tipo_incompativel`
   não bloqueiam.
3. Backup validado (restore drill, `k8s/backup/`).
4. Deploy. A migration desvincula as órfãs de `transacao_pai_id`, repete a
   pré-checagem e, se achar referência de outra família ou órfã, aborta com
   `Migration 0009_familia_fk_compostas abortada, nada foi alterado. Referências
de outra família ou órfãs: <tabela.coluna>=<n> ...` — tudo roda numa
   transação, então nenhuma linha nem constraint muda (nem a normalização das
   órfãs).

Verificar depois de aplicar:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname LIKE '%\_familia\_fk' OR conname LIKE '%\_id\_familia\_id\_unique'
ORDER BY conname;  -- 10 FKs + 4 uniques
```

### Rollback e roll-forward

Preferir **roll-forward** em produção (corrigir o dado ou a aplicação e manter a
proteção). Se for preciso remover as constraints, o rollback abaixo restaura o
schema da migration 0008 (as FKs simples voltam; `transacoes.cofrinho_id` e
`transacao_pai_id` voltam a não ter FK) e desmarca a 0009 no journal do Drizzle:

```sql
BEGIN;
ALTER TABLE transacoes DROP CONSTRAINT transacoes_categoria_familia_fk,
  DROP CONSTRAINT transacoes_metodo_pagamento_familia_fk,
  DROP CONSTRAINT transacoes_cofrinho_familia_fk,
  DROP CONSTRAINT transacoes_transacao_pai_familia_fk;
ALTER TABLE orcamento_categoria DROP CONSTRAINT orcamento_categoria_categoria_familia_fk;
ALTER TABLE templates_transacao DROP CONSTRAINT templates_transacao_categoria_familia_fk,
  DROP CONSTRAINT templates_transacao_metodo_pagamento_familia_fk,
  DROP CONSTRAINT templates_transacao_cofrinho_familia_fk;
ALTER TABLE movimentacoes_cofrinho DROP CONSTRAINT movimentacoes_cofrinho_cofrinho_familia_fk,
  DROP CONSTRAINT movimentacoes_cofrinho_transacao_familia_fk;
ALTER TABLE categorias DROP CONSTRAINT categorias_id_familia_id_unique;
ALTER TABLE metodos_pagamento DROP CONSTRAINT metodos_pagamento_id_familia_id_unique;
ALTER TABLE cofrinhos DROP CONSTRAINT cofrinhos_id_familia_id_unique;
ALTER TABLE transacoes DROP CONSTRAINT transacoes_id_familia_id_unique;
ALTER TABLE transacoes
  ADD CONSTRAINT transacoes_categoria_id_categorias_id_fk FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  ADD CONSTRAINT transacoes_metodo_pagamento_id_metodos_pagamento_id_fk FOREIGN KEY (metodo_pagamento_id) REFERENCES metodos_pagamento(id);
ALTER TABLE orcamento_categoria
  ADD CONSTRAINT orcamento_categoria_categoria_id_categorias_id_fk FOREIGN KEY (categoria_id) REFERENCES categorias(id);
ALTER TABLE templates_transacao
  ADD CONSTRAINT templates_transacao_categoria_id_categorias_id_fk FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  ADD CONSTRAINT templates_transacao_metodo_pagamento_id_metodos_pagamento_id_fk FOREIGN KEY (metodo_pagamento_id) REFERENCES metodos_pagamento(id),
  ADD CONSTRAINT templates_transacao_cofrinho_id_cofrinhos_id_fk FOREIGN KEY (cofrinho_id) REFERENCES cofrinhos(id);
ALTER TABLE movimentacoes_cofrinho
  ADD CONSTRAINT movimentacoes_cofrinho_cofrinho_id_cofrinhos_id_fk FOREIGN KEY (cofrinho_id) REFERENCES cofrinhos(id),
  ADD CONSTRAINT movimentacoes_cofrinho_transacao_id_transacoes_id_fk FOREIGN KEY (transacao_id) REFERENCES transacoes(id);
-- A 0009 é a última aplicada: remove o registro dela do journal do Drizzle.
DELETE FROM drizzle.__drizzle_migrations
WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations);
COMMIT;
```

O rollback **não restaura** os vínculos `transacao_pai_id` anulados — nem os
órfãos normalizados pela migration, nem os desvinculados depois por
`ON DELETE SET NULL`. Esses pais já não existiam (ou foram apagados), então não
há vínculo válido a recuperar; só um restore de backup traria de volta o valor
antigo.

O rollback do banco não basta sozinho se a imagem da API já inclui a 0009:
o migrator a reaplicaria no próximo start. Reverta junto a imagem (ou mantenha
a proteção e faça roll-forward).

**Roll-forward/reaplicar:** rodar a pré-checagem, corrigir os dados apontados
(reatribuir a referência para um registro da própria família ou anular a coluna
anulável — nunca apagar lançamentos sem decisão de domínio) e subir de novo
a API (no startup do pod, ou `pnpm --filter api db:migrate` fora de produção);
a 0009 é aplicada do zero.

### Testes PostgreSQL

`bash scripts/test-pg.sh` sobe um `postgres:17-alpine` descartável (só em
`127.0.0.1`), aplica todas as migrations reais pelo migrator do Drizzle e roda
`apps/api/src/db/tests/*.pg.test.ts` (`pnpm --filter api test:pg`, exige
`PG_TEST_ADMIN_URL`; fora da suíte unitária padrão). Cobre insert/update legítimo,
rejeição de cada FK composta, `NULL` aceito, `ON DELETE`, tradução do erro real do
driver e a migration sobre dados legados válidos e inválidos (incluindo órfãs
de `transacao_pai_id`, pai de outra família e `lock_timeout` com lock concorrente). Roda no CI no job
`db-constraints-tests`.
