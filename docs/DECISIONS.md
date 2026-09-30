# NossaGrana — Decisões Técnicas

Registro de todas as decisões técnicas tomadas para o projeto, com contexto e justificativa.

---

## Stack

| Camada        | Tecnologia                     | Justificativa                                                         |
| ------------- | ------------------------------ | --------------------------------------------------------------------- |
| Frontend      | React + Vite + TypeScript      | SPA moderna, build rápido, ecossistema sólido                         |
| Estilo        | Tailwind CSS                   | Utilitário, sem runtime, fácil de manter                              |
| PWA           | vite-plugin-pwa                | Integração nativa com Vite, suporte a Service Worker e Manifest       |
| Backend       | Node.js + Fastify + TypeScript | Melhor performance que Express no Raspberry Pi; validação nativa      |
| ORM           | Drizzle ORM                    | TypeScript-first, leve, queries tipadas, sem overhead de runtime      |
| Migrations    | Drizzle Kit                    | Integrado ao Drizzle, migrations versionadas                          |
| Banco         | PostgreSQL                     | Robusto, JSONB para dados de snapshot, queries complexas              |
| Validação     | Zod                            | Schemas compartilháveis entre frontend e backend via `packages/types` |
| Auth          | JWT + Refresh Token            | Stateless, seguro, padrão consolidado                                 |
| Hash de senha | bcrypt                         | Padrão seguro e bem suportado                                         |
| Tempo real    | WebSocket (via Fastify WS)     | Bidirecional, mais adequado para sync de dashboard                    |
| Agendamento   | node-cron                      | Leve, sem dependências externas, suficiente para o job de snapshot    |

---

## Infraestrutura

| Item           | Decisão                                                       |
| -------------- | ------------------------------------------------------------- |
| Hospedagem     | Self-hosted — Raspberry Pi 4B (8GB RAM, 500GB SSD)            |
| Cluster        | K3s (já instalado no Pi)                                      |
| HTTPS          | Cloudflare Tunnel (já configurado) — apenas ajustar o Ingress |
| Ingress        | Traefik (padrão do K3s)                                       |
| Registry       | GitHub Container Registry (GHCR)                              |
| CI/CD          | GitHub Actions com self-workflows                             |
| Deploy         | Build local → push GHCR → GitHub Actions aplica no K3s        |
| Imagens Docker | Multi-stage, target `linux/arm64`                             |

---

## Estrutura do Repositório

```
nossagrana/                     # Monorepo
├── apps/
│   ├── api/                    # Fastify backend
│   │   └── src/
│   │       ├── config/         # Env, constantes
│   │       ├── db/             # Schema Drizzle + migrations
│   │       ├── modules/        # Domínios (auth, familia, transacao, etc.)
│   │       └── plugins/        # Plugins Fastify (auth, websocket, etc.)
│   └── web/                    # React frontend
│       └── src/
│           ├── components/     # Componentes reutilizáveis
│           ├── pages/          # Telas da aplicação
│           ├── hooks/          # Custom hooks
│           ├── stores/         # Estado global
│           └── services/       # Chamadas à API
├── packages/
│   └── types/                  # DTOs e tipos compartilhados (Zod schemas)
├── k8s/                        # Manifests Kubernetes
├── docs/                       # Documentação do projeto
└── .github/workflows/          # GitHub Actions
```

---

## Padrões de Código

### Nomenclatura

- **Código TypeScript:** camelCase para variáveis e funções, PascalCase para tipos e classes
- **Banco de dados:** snake_case para tabelas e colunas
- **Arquivos:** kebab-case para arquivos e pastas

### Backend — Organização por domínio

Cada módulo tem sua própria pasta com:

```
modules/transacao/
├── transacao.routes.ts     # Definição de rotas Fastify
├── transacao.service.ts    # Lógica de negócio
├── transacao.repository.ts # Queries ao banco (Drizzle)
├── transacao.schema.ts     # Schema Zod para validação
└── transacao.types.ts      # Tipos TypeScript do módulo
```

### Frontend — Componentes

- Componentes funcionais com hooks
- Props tipadas com TypeScript
- Sem prop drilling excessivo — usar contexto ou Zustand para estado global

### Variáveis de Ambiente

**API (`apps/api/.env`):**

```
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://user:password@localhost:5432/nossagrana

JWT_SECRET=seu_jwt_secret_aqui
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=seu_refresh_secret_aqui
REFRESH_TOKEN_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

**Web (`apps/web/.env`):**

```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## Regras de Negócio Críticas

### Mês de Referência (UC31)

```
se metodo_pagamento.tipo == 'credito':
  se data_transacao.dia > metodo_pagamento.data_fechamento:
    mes_referencia = proximo_mes(data_transacao)
  else:
    mes_referencia = mes_atual(data_transacao)
else:
  mes_referencia = mes(data_transacao)
```

### Snapshot Mensal

- Job executa no último dia de cada mês (node-cron)
- Flag `divergente` é setado quando transações de meses com snapshot são editadas/excluídas
- Snapshot original **nunca** é recalculado

### Parcelas

- `valor_parcela = valor_total / numero_parcelas`
- Cada parcela tem `transacao_pai_id` apontando para a transação original
- Mês de referência de cada parcela é calculado individualmente (regra de crédito)

### Recorrências

- Geradas até `data_fim_recorrencia` ou indefinidamente se null
- Frequências: `mensal` | `semanal` | `quinzenal`
- Cancelamento remove lançamentos futuros não processados

---

## UX e Navegação

- **Navegação por plataforma:**
  - Desktop usa sidebar com acesso direto às áreas principais
  - Mobile usa tabs principais (`Dashboard`, `Extrato`, `Relatórios`, `Config`) e sub-telas dentro de `Config`
- **Entrada de transação sempre acessível:**
  - Mobile usa FAB flutuante (`+`)
  - Desktop usa botão fixo na barra superior
- **Onboarding de família:**
  - Fluxo explicita 3 caminhos: criar família, entrar por convite, buscar família e solicitar entrada

### Sistema Visual

- **Tema base:** dark-first no MVP, alinhado aos wireframes aprovados.
- **Design tokens centralizados:** todas as cores/spacing/radius/typography/shadow via tokens no tema do Tailwind (e/ou CSS variables), sem hardcode repetido em componentes.
- **Paleta semântica fixa:** `success`, `danger`, `warning`, `info`, `muted` para manter consistência entre dashboard, extrato, orçamento e histórico.
- **Iconografia padronizada:** adotar uma única biblioteca de ícones em toda a aplicação, com tamanho e espessura consistentes por contexto.
- **Regra de acessibilidade visual:** estados críticos devem combinar cor + texto/ícone (não só cor), com foco visível e contraste adequado.

---

## Segurança

- Senhas com bcrypt (salt rounds = 12)
- JWT de curta duração (15 min) + refresh token (7 dias)
- Todas as rotas autenticadas validam `familia_id` do usuário para isolamento multi-tenant
- PostgreSQL acessível somente via localhost / rede interna do K3s
- HTTPS garantido via Cloudflare Tunnel

### Convite de família: uso único e códigos de status (#67)

- `POST /familias/entrar/:codigo` consome o convite de forma atômica (UPDATE condicional + membership na mesma transação); convite vale para **um** usuário.
- A API distingue **409** (código existe e já foi consumido) de **404** (inexistente, expirado ou de família excluída). A distinção existe para o cliente poder orientar o usuário ("peça um novo código") e para a repetição segura (quem já entrou recebe 200).
- Risco de enumeração aceito: o código tem 48 bits aleatórios (12 hex) e a rota tem rate limit, então confirmar que um código existiu não é explorável na prática. Se o rate limit for afrouxado, reavaliar e colapsar 409 em 404.
- Repetição pelo mesmo usuário que consumiu o convite e ainda é membro devolve 200 (`ja_membro`); se ele foi removido depois, volta a ser 409.

### Exclusão de família: convites e sockets (#66, #147)

- **Exclusão** = `deleted_at` + invalidação dos convites pendentes (`expira_em = agora`) na mesma transação; depois do commit o service publica `familia:excluida` e o `WebSocketManager` fecha os sockets do room com o código `4004`.
- **Criação de convite x exclusão:** o INSERT em `convites` só toma lock de _chave_ na linha da família (FK), que não conflita com o `UPDATE familias`. `DrizzleConviteCriador` primeiro trava a linha com `SELECT ... FOR SHARE` exigindo `deleted_at IS NULL`, na mesma transação do INSERT. Exclusão em curso → o `FOR SHARE` espera, reavalia e não cria convite (404 `Familia nao encontrada`); criação em curso → a exclusão espera o commit e o seu `UPDATE convites` já enxerga (e expira) o convite. Assim nenhum convite pendente sobrevive a uma exclusão, nem "ressuscita" numa restauração feita por admin.
- **Handshake WebSocket x exclusão:** o evento é publicado depois do commit, então um handshake que já passou da checagem de acesso mas ainda não deu `join` perderia o evento. O handshake agora checa o acesso, entra no room e **checa de novo**; se a 2ª checagem ainda vê a família ativa, a exclusão commita depois dela, ou seja, o evento chega depois do `join` e `closeFamily` fecha o socket. Família excluída/sem vínculo na 2ª checagem fecha com `4004`/`4003`; erro ao revalidar fecha com `1011` (falha fechada).
- **Política de restauração:** o manager NÃO guarda "famílias fechadas" (sem tombstone/TTL). A fonte da verdade é o banco: enquanto `deleted_at` estiver preenchido o handshake é recusado, e ao restaurar a família novos sockets entram normalmente, sem evento nem limpeza de marca.
- Escopo: o barramento de eventos é em processo (réplica única do API no K3s). Com mais de uma réplica, `familia:excluida` precisaria de um canal compartilhado (ex.: LISTEN/NOTIFY); a revalidação pós-`join` continua cobrindo o handshake, mas sockets já abertos em outra réplica não seriam fechados.

### Ticket efêmero de WebSocket (#118, epic #115)

- **Problema:** o handshake recebia o access JWT em `?token=`; URLs acabam em logs de proxy/Cloudflare e ferramentas de diagnóstico. Agora o cliente troca o access (por HTTP, em `Authorization`) por um **ticket** e só o ticket vai na URL (`/api/ws?ticket=...&familiaId=...`). O servidor **não lê** `token` da query (ignorado); sem ticket válido o socket fecha com `4001`.
- **Contrato do ticket:** 256 bits de `crypto.randomBytes` (base64url), TTL de 30 s, **uso único**, vinculado a usuário + família + sessão (o `iat` do access que o pediu). Só o **SHA-256** do ticket é guardado; o valor bruto existe na resposta HTTP e na URL do handshake. O JWT nunca entra no ticket.
- **Emissão:** `POST /api/ws/ticket` (`authenticate` + `requireFamiliaScope`, header `x-familia-id`; rate limit 20/min por IP). Sessão revogada (#119) não obtém ticket (`401 SESSION_REVOKED`).
- **Consumo:** o handshake consome o ticket **antes** de qualquer outra checagem (uma única chamada atômica), confere a família da query com a do ticket e só então entra em `admitirSocket` (sessão → família → `join` → sessão/família de novo, #119/#147). Inexistente, expirado, reutilizado, de outra família ou query malformada: **mesmo** close (`4001`, motivo constante). Ticket de outra família é queimado ao ser tentado.
- **Armazenamento: `Map` em memória + TTL, sem tabela.** Decisão: o API roda em **réplica única** (K3s, `replicas: 1`) e o `WebSocketManager` e o `eventBus` já são em processo (ver "Exclusão de família"), então um store compartilhado não compra nada hoje e custaria migration, job de limpeza e uma ida ao banco por handshake. O consumo é atômico por construção: `consumir` lê e apaga sem `await` entre os dois passos, então o event loop não intercala outro handshake (teste: consumos simultâneos do mesmo ticket, só um passa). A interface `WsTicketStore` é assíncrona justamente para permitir um adapter PostgreSQL depois (`UPDATE ... SET usado_em = now() WHERE ticket_hash = $1 AND usado_em IS NULL AND expira_em > now() RETURNING ...`, mesmo padrão do convite, #145) **se** o API passar a ter mais de uma réplica; nesse caso o `eventBus` também precisaria de canal compartilhado, então é uma migração conjunta.
- **Custo aceito:** reinício do pod perde os tickets em voo (≤ 30 s); o cliente simplesmente reconecta com ticket novo (o backoff já existe). Uma varredura de 60 s (`setInterval` com `unref`, parada no `onClose`) devolve a memória dos tickets que ninguém consumiu; a expiração em si é conferida no consumo, não depende da varredura.
- **Logs:** o serializer `req` do Fastify grava a URL, então `opcoesDoLogger()` (`shared/http/log-redaction.ts`) troca o valor de `ticket`, `token`, `accessToken` e `refreshToken` da query por `[REDACTED]`. Proxies/Cloudflare à frente do API continuam vendo o ticket na URL; é um risco baixo e aceito porque o ticket vale uma vez e ~30 s, e já terá sido gasto pelo próprio cliente.
- **Alternativas descartadas:** cookie no handshake (depende de topologia/CSRF, é o escopo do #116) e subprotocolo `Sec-WebSocket-Protocol` (negociação extra e o valor também pode vazar em logs de proxy).

---

## Performance (considerações para o Raspberry Pi)

- Fastify tem overhead mínimo vs Express
- Drizzle ORM não tem cache em memória desnecessário
- Queries de dashboard devem ser otimizadas (índices em `mes_referencia` e `familia_id`)
- Conexão com banco via pool (máximo 10 conexões simultâneas)
- Build Docker multi-stage para imagens menores
