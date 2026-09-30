# Sessões, revogação e WebSocket (#118 e #119, epic #115)

## Modelo

- **Revogação global** = um marcador por usuário em `revoked_refresh_tokens`
  (`token_hash = '__compromised__<userId>'`) com `revoked_at` = instante da
  revogação. Cada revogação nova **avança** `revoked_at` (upsert), e o marcador
  é **monotônico**: nunca retrocede (ver "Monotonicidade do marcador").
- Um token (access ou refresh) é da sessão revogada quando seu `iat` (segundos)
  é **menor ou igual ao segundo da revogação**. Token sem `iat` com revogação
  registrada também é tratado como revogado (falha fechada). Um novo login
  depois da revogação emite tokens com `iat` maior e funciona normalmente.
- Quem revoga: `SessaoRevogacaoService.revogarTodas(userId)` — único ponto usado
  por **troca de senha** (`PATCH /auth/senha`), **reset de senha** e **detecção
  de reuso de refresh**. Grava primeiro; só depois publica `sessao:revogadas`
  no EventBus (mesmo padrão de `familia:excluida`).
- O marcador antigo era só "existe/não existe" e bloqueava o usuário por 365
  dias (nem um login novo renovava a sessão). Com `iat` x `revoked_at`, só as
  sessões anteriores morrem.

## O que acontece na troca de senha

1. `updateSenhaHash`, depois `revogarTodas` (nessa ordem: um login com a senha
   antiga depois da revogação e antes do update criaria sessão que sobreviveria).
2. Refresh emitido antes da troca → `401 { code: 'SESSION_REVOKED' }`.
3. Sockets do usuário (todas as famílias, todos os dispositivos) → close `4005`.
4. Handshake com access emitido antes da troca → close `4005` (não reconecta).
5. Falha ao gravar a revogação → 500 (não é mascarada como "senha incorreta").
   A senha já foi trocada nesse caso; repetir a operação exige a senha nova.
   Senha e revogação **não** compartilham transação (repositórios distintos);
   o estado é logado (`error`, com `userId`) via `SessoesNaoRevogadasError` e as
   sessões antigas valem até o refresh/access expirar. Risco residual aceito
   (mesma janela do access; a remediação manual é nova troca de senha com a senha
   nova). Vale também para `reset-password`. Transação única fica como melhoria
   futura.
6. Web (`perfil-page`): após o 204 a tela avisa "Senha alterada. Entre
   novamente." e faz logout explícito (~2,5 s), independente de o WS estar
   conectado. Erros: 401 → "Senha atual incorreta."; demais → mensagem genérica.

Reuso de refresh já rotacionado (`tratarReuso`): se a revogação global falhar,
o erro é logado (`error`, `userId`) e a resposta segue `TOKEN_REUSE_DETECTED`.

## Decisões de design registradas (review do #150)

- **Granularidade do `iat` (segundos):** token emitido no mesmo segundo da
  revogação é tratado como revogado. Um login imediatamente após a troca pode
  nascer revogado; na prática o usuário leva >1 s para digitar. Claim com
  precisão de ms / contador de versão de sessão fica como melhoria futura
  (também abriria a porta para devolver um par novo no `PATCH /auth/senha`).
- **`renovarSessao(fastify, …)`** depende dos decorators do Fastify em vez de
  service injetado; refator adiado.

## Monotonicidade do marcador (follow-up do #150, P1 do review)

Duas revogações globais sobrepostas (ex.: troca de senha + reset, ou reuso de
refresh) carimbam `agora` na app **antes** de esperar o banco; a mais antiga
pode commitar por último. Com `SET revoked_at = <agora da requisição>` ela
sobrescreveria o instante mais novo e um refresh emitido entre os dois
instantes (já invalidado pela revogação mais nova) voltaria a valer.

- `DrizzleRevokedTokenRepository.revokeAllByUserId` resolve o conflito no banco:
  `revoked_at = GREATEST(existente, novo)` e `expires_at = GREATEST(existente, novo)`
  (`ON CONFLICT (token_hash) DO UPDATE`). Sob lock de linha, a escrita que
  espera lê o valor já commitado, então a ordem de commit não importa.
- **Semântica do expiry:** `expires_at = revoked_at + 365 dias`, função crescente
  do `revoked_at`; portanto `GREATEST` nos dois mantém os dois da **mesma**
  revogação (a mais recente). O expiry nunca fica abaixo da validade máxima dos
  tokens invalidados (refresh de 7 dias) e o cleanup não remove o marcador antes.
- O carimbo continua no **relógio da app**, o mesmo do `iat` dos tokens (por isso
  não se usa `now()` do banco: clocks distintos app x banco poderiam deslocar a
  comparação `iat <= revoked_at`). Contrato público (`revokeAllByUserId(userId)`,
  `findRevokedAllAt`) inalterado; o relógio é injetável só nos testes.
- `InMemoryRevokedTokenRepository` aplica o mesmo máximo.
- Testes: InMemory (`revoked-token.repository.test.ts`), SQL do upsert
  (`revoked-token.drizzle.test.ts`) e PostgreSQL real com ordem invertida e
  rodadas concorrentes com carimbos embaralhados (`sessao-revogada.pg.test.ts`).

## Janela do access token

Rotas HTTP autenticadas **não** consultam a revogação (evita uma query por
request): o access já emitido segue válido até expirar (`JWT_EXPIRES_IN`, 15
min). Só o refresh e o handshake do WebSocket checam o marcador. Reduzir a
janela exigiria checagem por request ou versão de sessão (fora do escopo do #119).

## Corrida refresh x revogação

`renovarSessao` (`auth.refresh.ts`): checar → gastar o refresh → emitir o novo
par → **checar de novo** o refresh antigo. Revogação gravada entre a 1ª checagem
e a emissão é vista pela 2ª; gravada depois, tem `revoked_at` >= instante da
emissão, então o `iat` do par novo cai na regra "até o segundo da revogação".
Residual aceito: `revoked_at` é carimbado no relógio da app antes do write; um
write que cruze a virada de segundo entre o carimbo e o commit, exatamente
durante um refresh, pode deixar o par novo sobreviver. O relógio é o mesmo do
`iat` (um único host/réplica).

## WebSocket

| Código | Constante                   | Quando                                                         | Cliente             |
| ------ | --------------------------- | -------------------------------------------------------------- | ------------------- |
| 4001   | `WS_CLOSE_NAO_AUTENTICADO`  | ticket ausente/inválido/expirado/usado/de outra família (#118) | reconecta c/ ticket |
| 4003   | (handshake)                 | usuário sem vínculo com a família                              | não reconecta       |
| 4004   | `WS_CLOSE_FAMILIA_EXCLUIDA` | família excluída                                               | não reconecta       |
| 4005   | `WS_CLOSE_SESSAO_REVOGADA`  | sessões revogadas (senha) ou handshake com token pré-revogação | limpa sessão, login |
| 4006   | `WS_CLOSE_MEMBRO_REMOVIDO`  | admin removeu o usuário da família (só os sockets dele nela)   | não reconecta       |

- `WebSocketManager` guarda o dono de cada socket (`join(familiaId, ws, userId)`)
  e expõe `closeUser` (todas as famílias) e `closeUserInFamily` (uma família).
- Handshake: consome o ticket (ver seção abaixo), checa a sessão, entra no room, checa **de novo** (evento publicado
  após commit não se perde entre a 1ª checagem e o `join`; raciocínio do #147).
  O vínculo com a família já era revalidado duas vezes (#147), o que cobre a
  remoção de membro concorrente ao handshake.
- Mensagens de fechamento são genéricas: nunca incluem ids, e-mail ou tokens.

## Ticket efêmero de WebSocket (#118)

O JWT deixou de ir na URL do WebSocket. Decisão e alternativas em `docs/DECISIONS.md`
("Ticket efêmero de WebSocket").

**Fluxo**

1. Cliente: `POST /api/ws/ticket` com `Authorization: Bearer <access>` e `X-Familia-Id`
   (passa por `authenticate` + `requireFamiliaScope`: membership validada **antes** de emitir).
   Resposta: `{ ticket, expiraEm }`.
2. Cliente: `new WebSocket(".../api/ws?ticket=<ticket>&familiaId=<id>")`. Nenhum JWT na URL.
3. Servidor: consome o ticket, confere que a família da query é a do ticket, e segue para
   `admitirSocket` (sessão → família → `join` → sessão/família de novo; #119/#147).
4. Reconexão: **sempre** um ticket novo (o anterior já foi gasto). O store web faz isso a cada
   tentativa. Falhas na emissão: `401` encerra a sessão local (o `ApiClient` já tentou o
   refresh), `403` para sem reconectar, `429` espera o `Retry-After` (padrão 60 s, mínimo 1 s) e
   tenta de novo sem gastar tentativas nem deslogar; demais erros (rede, 5xx) entram no backoff
   existente e, esgotadas as tentativas, deixam `status: 'error'` **sem** logout e seguem tentando a cada 30 s até a API voltar (ou `disconnect`). Só o socket que
   cai repetidamente depois de um ticket válido encerra a sessão ao esgotar as tentativas.

**Propriedades**

| Propriedade        | Como                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta entropia      | 32 bytes de `crypto.randomBytes`, base64url (43 caracteres)                                                                                                                |
| Curto              | TTL de 30 s (`WS_TICKET_TTL_MS`); expirado é recusado no consumo                                                                                                           |
| Uso único          | `consumir` lê e apaga sem `await` no meio (atômico); teste com consumos simultâneos                                                                                        |
| Vinculado          | usuário + família + `iat` do access (sessão); família divergente na query é recusada                                                                                       |
| Só hash persistido | o store guarda SHA-256; o valor bruto não é guardado nem logado                                                                                                            |
| Sem JWT no ticket  | o ticket é opaco; a sessão é representada só pelo `iat`                                                                                                                    |
| Sessão revogada    | não obtém ticket (`401 { error: { code: 'SESSION_REVOKED' } }`, envelope de api-design.md); ticket já emitido é recusado no handshake                                      |
| Sem detalhe        | todas as recusas de autenticação: close `4001`, motivo `Autenticacao invalida`                                                                                             |
| Rate limit         | 20 emissões/min por usuário (`sub`) no endpoint, contado em `preHandler`, depois do `authenticate`; o limite global por IP (100/min) continua valendo para as demais rotas |

- Um ticket de outra família, ao ser tentado, é **queimado** (não serve nem para a família certa).
- `?token=` na URL é **ignorado** pelo servidor (não é lido nem validado): access válido sem
  ticket fecha com `4001`. Não há janela de compatibilidade com o formato antigo.
- Falha do store ao consumir fecha com `1011` (falha fechada).
- Armazenamento em memória (Map + TTL), válido enquanto o API for réplica única; o que muda se
  isso deixar de valer está em DECISIONS.md. Um reinício perde tickets em voo (≤ 30 s): o cliente
  reconecta com ticket novo. Os Deployments do API usam `strategy: Recreate` para que o pod velho
  e o novo nunca recebam tráfego ao mesmo tempo (um ticket emitido num seria recusado no outro).

**Logs:** o serializer `req` do logger do Fastify (`opcoesDoLogger`) redige `ticket`, `token`,
`accessToken` e `refreshToken` na query (`[REDACTED]`), comparando a chave já decodificada
(`?%74icket=` também é redigido). As mensagens de fechamento e de erro
nunca incluem ticket, id ou e-mail. Infra à frente do API (proxy/Cloudflare) ainda enxerga a
URL do handshake; o ticket vale uma vez e ~30 s.

**Testes:** `ws-ticket.service.test.ts` (TTL, uso único, outra família, concorrência, limpeza),
`ws-ticket.routes.test.ts` e `ws-ticket.scope.test.ts` (emissão, 401/400, sessão revogada,
membership real e rate limit), `ws.routes.test.ts` (handshake: reuso, simultâneo, expirado,
família trocada, `?token=` ignorado, motivo único), `log-redaction.test.ts` e
`websocket.store.test.ts` (ticket novo por reconexão, sem token na URL).

## Fora do escopo (outras issues do epic #115)

Cookie HttpOnly para refresh (#116) e access em memória (#117): o access ainda é guardado no
`localStorage`, mas agora só trafega em `Authorization`, nunca na URL do WebSocket. E2E de
sessão (#120).

## Rollout / rollback

Sem migration (usa `revoked_refresh_tokens`; os tickets do #118 ficam em memória). Em falha, preservar a revogação do
reset e corrigir só o gatilho da troca normal; não revalidar sessões
potencialmente comprometidas.

Rollback do #118: reverter o deploy restaura o handshake por `?token=`, que é o fluxo anterior;
como a API e o web sobem juntos, não há cliente novo falando com servidor antigo.

**Custo aceito no deploy do #118:** o servidor novo ignora `?token=`. Uma aba aberta (ou bundle
PWA em cache) de antes do deploy ainda conecta com `?token=`; quando o socket cai no deploy, ele
recebe `4001` a cada tentativa e, ao esgotar as 5 tentativas (~3 s de backoff), o código antigo
chama `clearSession`: **todo usuário com aba antiga aberta é deslogado uma vez** e precisa entrar
de novo (o bundle novo é carregado no login). Não há janela de compatibilidade com `?token=` por
decisão de segurança (o ponto do #118 é tirar o JWT da URL). O impacto é um novo login, sem perda
de dados.
