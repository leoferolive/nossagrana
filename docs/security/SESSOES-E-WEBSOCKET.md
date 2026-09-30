# Revogação de sessões e encerramento de WebSocket (#119, epic #115)

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
| 4003   | (handshake)                 | usuário sem vínculo com a família                              | não reconecta       |
| 4004   | `WS_CLOSE_FAMILIA_EXCLUIDA` | família excluída                                               | não reconecta       |
| 4005   | `WS_CLOSE_SESSAO_REVOGADA`  | sessões revogadas (senha) ou handshake com token pré-revogação | limpa sessão, login |
| 4006   | `WS_CLOSE_MEMBRO_REMOVIDO`  | admin removeu o usuário da família (só os sockets dele nela)   | não reconecta       |

- `WebSocketManager` guarda o dono de cada socket (`join(familiaId, ws, userId)`)
  e expõe `closeUser` (todas as famílias) e `closeUserInFamily` (uma família).
- Handshake: checa a sessão, entra no room, checa **de novo** (evento publicado
  após commit não se perde entre a 1ª checagem e o `join`; raciocínio do #147).
  O vínculo com a família já era revalidado duas vezes (#147), o que cobre a
  remoção de membro concorrente ao handshake.
- Mensagens de fechamento são genéricas: nunca incluem ids, e-mail ou tokens.

## Fora do escopo (outras issues do epic #115)

Cookie HttpOnly para refresh (#116), access em memória (#117) e ticket efêmero
de WebSocket (#118). Hoje o access ainda vai na query string do WS; a checagem
de revogação do handshake independe de como o token chega.

## Rollout / rollback

Sem migration (usa `revoked_refresh_tokens`). Em falha, preservar a revogação do
reset e corrigir só o gatilho da troca normal; não revalidar sessões
potencialmente comprometidas.
