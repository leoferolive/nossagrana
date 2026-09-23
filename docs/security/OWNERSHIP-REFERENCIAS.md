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
  HTTP **422** `{ code: 'REFERENCIA_INVALIDA', message }`.
- ID de outra família e ID inexistente têm **a mesma resposta** (`nao_encontrada`);
  a mensagem ecoa só o ID recebido e a família do próprio usuário.
- `referenciaEsperada(id, idAtual)`: vínculo **novo ou alterado** exige registro
  ativo; o **mesmo vínculo já gravado** pode estar inativo.
- Categoria com `tipo` informado precisa ter o mesmo tipo do lançamento.

## Matriz

| Operação                            | Referência                | Regra                                                          |
| ----------------------------------- | ------------------------- | -------------------------------------------------------------- |
| `POST /transacoes`                  | `categoriaId`             | da família, ativa, tipo = tipo da transação                    |
|                                     | `metodoPagamentoId`       | da família, ativo                                              |
|                                     | `cofrinhoId` (interno)    | da família, ativo                                              |
| `PATCH /transacoes/:id`             | `categoriaId`             | da família, tipo igual; ativa só se trocou                     |
|                                     | `metodoPagamentoId`       | da família; ativo só se trocou                                 |
| `POST /orcamento/:categoriaId`      | `categoriaId`             | da família; ativa se não houver orçamento vigente              |
| `POST /templates-transacao`         | categoria/método/cofrinho | da família, ativos; categoria com tipo do template             |
| `PATCH /templates-transacao/:id`    | categoria/método/cofrinho | da família; ativos só se trocaram; `null` remove o vínculo     |
| `POST /templates-transacao/aplicar` | vínculos gravados         | da família (inativos permitidos); valida todos antes de gravar |

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
família em produção.

## Próximos passos (epic #54)

- #58: FKs compostas `(id, familia_id)` para bloquear escrita cross-tenant fora
  da API — o diagnóstico acima mostra que não há dados a limpar antes.
- `cofrinho_id` em `transacoes` não tem FK; avaliar junto com #58.
