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

---

## Performance (considerações para o Raspberry Pi)

- Fastify tem overhead mínimo vs Express
- Drizzle ORM não tem cache em memória desnecessário
- Queries de dashboard devem ser otimizadas (índices em `mes_referencia` e `familia_id`)
- Conexão com banco via pool (máximo 10 conexões simultâneas)
- Build Docker multi-stage para imagens menores
