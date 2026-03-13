# NossaGrana

PWA de gestao financeira familiar, self-hosted em Raspberry Pi 4B com K3s.

## Stack

- Backend: Node.js + Fastify + TypeScript
- ORM: Drizzle ORM + Drizzle Kit
- Banco: PostgreSQL
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Monorepo: pnpm workspaces + Turborepo

## Como iniciar localmente (passo a passo)

### 1. Pre-requisitos

- Node.js 20+ instalado
- Corepack habilitado
- Docker (opcional, caso rode o Postgres localmente)

Comandos:

```bash
node -v
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
```

### 2. Instalar dependencias do monorepo

Na raiz do projeto:

```bash
pnpm install
```

### 3. Configurar variaveis de ambiente

Crie os arquivos `.env` a partir dos exemplos:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edite `apps/api/.env` com os dados do seu banco em `DATABASE_URL`.
Formato esperado:

```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:PORTA/BANCO
```

Exemplo local:

```env
DATABASE_URL=postgresql://nossagrana:nossagrana@localhost:5432/nossagrana
```

### 4. Subir banco PostgreSQL

Opcao A: Postgres local via Docker:

```bash
docker run -d --name nossagrana-db \
  -e POSTGRES_USER=nossagrana \
  -e POSTGRES_PASSWORD=nossagrana \
  -e POSTGRES_DB=nossagrana \
  -p 5432:5432 \
  postgres:16
```

Opcao B: usar um Postgres remoto:

- apenas ajuste o `DATABASE_URL` no `apps/api/.env`
- garanta conectividade de rede entre sua maquina e o host do banco

### 5. Rodar migrations

```bash
pnpm --filter api db:migrate
```

Se precisar gerar novas migrations:

```bash
pnpm --filter api db:generate
```

### 6. Subir a aplicacao em modo desenvolvimento

Na raiz:

```bash
pnpm dev
```

Servicos esperados:

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

### 7. Validar se subiu corretamente

Health-check da API:

```bash
curl http://localhost:3000/api/health
```

Abra no navegador:

- `http://localhost:5173`

## Comandos uteis

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm test
pnpm deps:check
```

## Troubleshooting rapido

- Erro de `pnpm` nao encontrado:
  - rode `corepack enable` e `corepack prepare pnpm@9.15.0 --activate`
- API falha com erro de env:
  - confirme `apps/api/.env` com `DATABASE_URL`, `JWT_SECRET` e `REFRESH_TOKEN_SECRET`
- Falha ao conectar no banco:
  - valide host/porta/usuario/senha no `DATABASE_URL`
  - se for Docker local, confira se o container `nossagrana-db` esta em execucao

## Infra de deploy (base)

- Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile`
- Kubernetes: `k8s/`
- CI/CD: `.github/workflows/ci.yml` + workflows de release/deploy em `.github/workflows/`

## Documentacao

- `docs/PRD.md`
- `docs/FLOWS.md`
- `docs/USE_CASES.md`
- `docs/DECISIONS.md`
- `docs/DEPENDENCY_POLICY.md`
- `TASKS.md`
