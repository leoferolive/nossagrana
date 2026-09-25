# Idempotência das operações financeiras

> Issue #90 (epic #64). Implementação: `apps/api/src/shared/idempotencia/`.

Parcelas, recorrências, aportes, retiradas e a aplicação de templates já são
atômicos (Unit of Work, #78/#85/#59/#89): nunca há lote parcial. Faltava o
reenvio: a mesma requisição reenviada (timeout, rede instável) gravava tudo de
novo. O header `Idempotency-Key` deduplica a mesma requisição com a mesma
chave; reenvios iniciados pelo usuário no app ainda dependem da #96 (ver
Frontend).

## Contrato

| Rota                                    | Sucesso | Header aceito              |
| --------------------------------------- | ------- | -------------------------- |
| `POST /api/transacoes`                  | 201     | `Idempotency-Key` opcional |
| `POST /api/cofrinhos/:id/aportes`       | 201     | `Idempotency-Key` opcional |
| `POST /api/cofrinhos/:id/retiradas`     | 201     | `Idempotency-Key` opcional |
| `POST /api/templates-transacao/aplicar` | 200     | `Idempotency-Key` opcional |

- **Formato:** 8 a 128 caracteres `[A-Za-z0-9_-]` (um UUID serve). Fora disso:
  **400** `{ error: { message, code: 'IDEMPOTENCIA_CHAVE_INVALIDA' } }`, nada executado.
- **Mesma chave + mesma requisição, dentro de 24h:** devolve o **mesmo status
  e corpo** da primeira execução, com o header `Idempotent-Replayed: true`.
  Nada é gravado e nenhum evento (`transacao:alterada`) é emitido.
- **Mesma chave + outra requisição** (outra rota, outro `:id`, outro corpo ou
  outro usuário): **422** `{ error: { message, code: 'IDEMPOTENCIA_CONFLITO' } }`,
  nada executado.
- **Sem o header:** comportamento anterior, **sem deduplicação** — cada envio
  executa e grava de novo (dois `POST /transacoes` parcelados iguais geram duas
  séries). Testado explicitamente para não mudar por acidente.
- **Escopo:** a chave é por família (`familia_id`, `chave`). A mesma chave em
  outra família é outra operação; uma família nunca enxerga chaves de outra.
- **Janela:** 24h. Depois disso a chave vale como nova e é apagada pelo job de
  limpeza (de hora em hora, `idempotencia-limpeza.job.ts`).

## Como funciona

1. A rota lê o header e monta o pedido: `operacao` (rota-template, ex.
   `POST /api/cofrinhos/:id/aportes`) e `hash_payload` = sha256 do JSON
   canônico de `{ usuarioId, params, corpo }`. Só o hash é gravado.
2. As validações de entrada (ownership, templates, categoria do cofrinho)
   rodam antes, como sempre — também num replay. Se o estado mudou entre o
   envio original e o retry a ponto de a validação falhar, o retry recebe esse
   erro e nada é executado (nunca duplica; só a resposta é menos útil).
3. Dentro da **mesma Unit of Work** da operação, a 1ª escrita é
   `INSERT ... ON CONFLICT (familia_id, chave) DO UPDATE ... WHERE expirada`:
   - inseriu → executa a operação e, antes do commit, grava `status_code` +
     `resposta` (só 2xx);
   - já existia → a requisição concorrente **espera no índice único** até a
     primeira confirmar (→ replay) ou desfazer (→ a reserva passa a ser dela e
     ela executa).
4. Falha em qualquer escrita → rollback apaga dados **e** a chave: um retry com
   a mesma chave executa de novo (é o comportamento correto).
5. Eventos só saem depois do commit e só na execução nova.

`DO UPDATE ... WHERE criado_em < now() - 24h` (em vez de `DO NOTHING`) serve
para uma chave expirada ainda não limpa valer como nova, sem depender do job.

## Tabela `chaves_idempotencia` (migration 0011)

| Coluna         | Tipo         | Notas                                             |
| -------------- | ------------ | ------------------------------------------------- |
| `familia_id`   | uuid         | FK `familias` (ON DELETE CASCADE); PK com `chave` |
| `chave`        | text         | valor do header                                   |
| `operacao`     | text         | rota-template                                     |
| `hash_payload` | text         | sha256 hex                                        |
| `status_code`  | integer null | `null` só enquanto a transação dona está aberta   |
| `resposta`     | jsonb null   | corpo enviado ao cliente                          |
| `criado_em`    | timestamptz  | índice para a limpeza                             |

CHECK `chaves_idempotencia_resposta_2xx`: status e resposta andam juntos e o
status é 2xx.

## Frontend

`apps/web/src/services/idempotencia.ts`: cada ponto de submit (modal de
transação, aporte, retirada, aplicar templates) gera **uma chave por envio**
e os services aceitam essa chave externa (`chaveIdempotencia?`).

**O que isso protege hoje:** o reenvio da **mesma requisição com a mesma
chave** — retentativas de infraestrutura (proxy/ingress, service worker) ou
qualquer cliente que reuse a chave. O servidor devolve a resposta gravada.

**O que ainda NÃO protege:** o reenvio feito pelo usuário. Os modais fecham
antes do resultado; se a rede falhar, um novo clique gera uma chave **nova** e
a operação é executada de novo. O retry do `ApiClient` também não entra aqui:
ele só repete após 401, e o 401 é barrado no preHandler de autenticação antes
de a chave ser reservada. A deduplicação ponta a ponta de reenvios do usuário
depende da **#96** (contrato assíncrono do modal): aguardar o resultado,
manter o formulário aberto em caso de erro e **reutilizar a mesma chave até o
sucesso**. O gancho já está pronto — a chave é gerada por envio no ponto de
submit e os services recebem a chave de fora; basta a #96 guardar a chave
entre tentativas.

`crypto.randomUUID()` só existe em contexto seguro (HTTPS/localhost). Em HTTP
puro (ex.: `dev-app.nossagrana.home`) o helper cai para um UUID v4 gerado com
`crypto.getRandomValues`, em vez de lançar `TypeError` e perder o envio.

## Testes

- Unitários (fakes nomeadas, `InMemoryIdempotenciaRepository` participando da
  `InMemoryUnitOfWork`): replay, conflito, sem chave duplica, isolamento entre
  famílias e matriz de falha em cada posição N de escrita (parcelas,
  recorrências, aporte, retirada, aplicar) — zero registros e zero chave.
- PostgreSQL real (`bash scripts/test-pg.sh`, `idempotencia.pg.test.ts`):
  concorrência com a mesma chave (uma execução, a outra replay), rollback
  remove a chave, CHECK/FK e migration 0011 sobre dados existentes.
