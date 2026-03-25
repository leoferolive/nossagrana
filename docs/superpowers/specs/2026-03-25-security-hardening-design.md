# Security Hardening — Design Spec

**Data:** 2026-03-25
**Status:** Aprovado
**Escopo:** 5 correções de segurança prioritárias identificadas na auditoria

---

## Contexto

Auditoria de segurança realizada em 2026-03-25 com 5 agentes especializados identificou 35 vulnerabilidades na codebase do NossaGrana. Este documento especifica o design das 5 correções mais críticas.

---

## 1. Rate Limiting

### Dependência

- `@fastify/rate-limit`

### Pré-requisito: trustProxy

Configurar `trustProxy: true` na instância Fastify em `app.ts`, pois a API roda atrás de nginx/Traefik. Sem isso, `@fastify/rate-limit` usa o IP do proxy em vez do IP real do cliente.

### Rate Limiting Global

- Registrado em `app.ts` como plugin Fastify
- 100 req/min por IP
- Store em memória (single-instance no Raspberry Pi)
- `allowList`: excluir rota `/api/health` (usada por probes K8s)

### Rate Limiting por Rota

| Rota                  | Limite | Janela |
| --------------------- | ------ | ------ |
| `POST /auth/login`    | 5      | 1 min  |
| `POST /auth/register` | 3      | 1 min  |
| `POST /auth/refresh`  | 10     | 1 min  |
| `POST /admin/*`       | 3      | 1 min  |

### Response 429

```json
{ "error": { "message": "Muitas tentativas. Tente novamente em X segundos." } }
```

### Arquivos Afetados

- `apps/api/package.json` — adicionar dependência
- `apps/api/src/app.ts` — registrar plugin global + `trustProxy: true`
- `apps/api/src/modules/auth/auth.routes.ts` — config por rota
- `apps/api/src/modules/admin/admin.routes.ts` — config por rota

---

## 2. ADMIN_SECRET Obrigatório

### Mudanças em `apps/api/src/config/env.ts`

- Remover `.default('changeme-admin-secret')`
- Alterar para `z.string().min(32)`
- Adicionar `.refine()` que rejeita valores contendo `changeme`
- Também aumentar `JWT_SECRET` e `REFRESH_TOKEN_SECRET` de `.min(8)` para `.min(32)`

### Mudanças em `apps/api/.env.example`

- Adicionar `ADMIN_SECRET=` com comentário explicativo sobre mínimo 32 chars

### Mudanças em `apps/api/vitest.setup.ts`

- Adicionar `process.env.ADMIN_SECRET = 'test-admin-secret-with-32-chars!'` (>= 32 chars, sem "changeme")

### Impacto

- Desenvolvedor deve setar `ADMIN_SECRET` no `.env` local (mínimo 32 caracteres)
- O `.env` de dev precisa ter `JWT_SECRET` e `REFRESH_TOKEN_SECRET` com >= 32 chars

---

## 3. Refresh Token Rotation com Detecção de Roubo

### Fluxo do `POST /auth/refresh`

```
1. Receber refresh token
2. Verificar se está em revoked_refresh_tokens:
   - SE REVOGADO → revogar TODOS tokens do userId → 401 TOKEN_REUSE_DETECTED
   - SE VÁLIDO → continuar
3. Revogar refresh token atual
4. Gerar novo par (access + refresh token)
5. Retornar { accessToken, refreshToken }
```

### Schema Migration (OBRIGATÓRIO)

A tabela `revoked_refresh_tokens` atualmente NÃO possui coluna `user_id`. Sem ela, é impossível implementar `revokeAllByUserId`. Mudanças necessárias:

- `apps/api/src/db/schema.ts`: adicionar coluna `userId` (`user_id UUID NOT NULL REFERENCES users(id)`) à tabela `revokedRefreshTokens`, com índice em `user_id`
- Gerar migration Drizzle via `pnpm --filter api db:generate`
- Aplicar migration via `pnpm --filter api db:migrate`

### Arquivos Afetados

**Shared Types:**

- `packages/types/src/index.ts`
  - Atualizar `authRefreshResponseSchema` para incluir campo `refreshToken`
  - Rebuildar: `pnpm --filter @nossagrana/types build`

**Backend:**

- `apps/api/src/db/schema.ts` — adicionar `userId` à tabela `revokedRefreshTokens`
- `apps/api/src/modules/auth/revoked-token.repository.ts`
  - Atualizar `revokeToken()` para aceitar e armazenar `userId`
  - Adicionar `revokeAllByUserId(userId: string)`: revoga todos os tokens de um usuário
  - Adicionar `isRevoked(tokenHash: string): Promise<boolean>`: verifica se token específico está revogado
  - Atualizar `InMemoryRevokedTokenRepository` com os mesmos métodos
- `apps/api/src/modules/auth/auth.routes.ts`
  - Alterar endpoint `/auth/refresh`: verificar revogação → se revogado, revogar TODOS do userId → 401; se válido, revogar token atual + gerar novo par
  - Alterar response para incluir `refreshToken` além de `accessToken`
- `apps/api/src/modules/auth/auth.schema.ts`
  - Atualizar response schema local se existir

**Frontend:**

- `apps/web/src/services/api-client.ts`
  - Alterar `refreshAccessToken()` para ler novo `refreshToken` do response
  - Adicionar callback `setRefreshToken` ao `ApiClientOptions`
  - Salvar novo refresh token via callback
- `apps/web/src/contexts/auth-context.tsx`
  - Passar `setRefreshToken` callback ao `ApiClient`
  - Atualizar session no localStorage com novo refresh token
- `apps/web/src/services/core-financeiro.service.ts`
  - Atualizar `lazyApiClient` para passar `setRefreshToken`

### Detecção de Roubo

Se um refresh token já revogado for usado, significa que alguém (atacante ou usuário legítimo) está reutilizando um token antigo. A resposta é invalidar TODA a sessão do usuário, forçando re-login. O frontend deve distinguir `TOKEN_REUSE_DETECTED` de expiração normal para mostrar mensagem de "sessão comprometida".

---

## 4. .dockerignore + PostgreSQL Secret

### `.dockerignore` na raiz

```
.env
.env.*
.git
.claude
node_modules
coverage
*.log
*.test.ts
*.test.tsx
vitest.*
k8s/
docs/
.github/
audit-screenshots/
planilha/
.worktrees/
```

### PostgreSQL Secret

**Remover de `k8s/postgres/statefulset.yaml`:**

- Remover o objeto `Secret` (`nossagrana-postgres-secrets`) com `stringData` hardcoded
- Manter o StatefulSet e Service intactos
- O StatefulSet já referencia `nossagrana-postgres-secrets` via `envFrom.secretRef` — manter esse nome

**Criar `k8s/postgres/README.md`:**

- Instruções para criar secret manualmente (incluindo `POSTGRES_DB`):
  ```bash
  kubectl create secret generic nossagrana-postgres-secrets \
    --namespace nossagrana \
    --from-literal=POSTGRES_USER=nossagrana \
    --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
    --from-literal=POSTGRES_DB=nossagrana
  ```

**Atualizar `.gitignore`:**

- Substituir `k8s/secrets-real.yaml` por `k8s/**/secret*.yaml` (padrão mais abrangente)

---

## 5. Security Headers (Helmet + Nginx)

### API — `@fastify/helmet` (sem CSP)

**Dependência:** `@fastify/helmet`

A API é um backend JSON puro — não serve HTML. CSP é inútil em respostas JSON (é enforced pelo browser apenas em documentos HTML). Helmet será usado sem CSP, apenas para os demais headers de segurança.

**Configuração em `app.ts`:**

```typescript
await app.register(import('@fastify/helmet'), {
  contentSecurityPolicy: false, // API não serve HTML
  crossOriginEmbedderPolicy: false,
});
```

### Nginx — `nginx.conf` (com CSP)

O CSP será aplicado no nginx, que serve o HTML do frontend.

**Nota:** Em nginx, `add_header` dentro de um bloco `location` **substitui** todos os `add_header` do bloco `server`. O `/health` location que tem `add_header Content-Type text/plain` precisa ser tratado com `types` em vez de `add_header`.

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  server_tokens off;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:;" always;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /health {
    default_type text/plain;
    return 200 'ok';
  }
}
```

### Arquivos Afetados

- `apps/api/package.json` — adicionar `@fastify/helmet`
- `apps/api/src/app.ts` — registrar plugin
- `apps/web/nginx.conf` — reescrever com security headers + CSP

---

## Testes

### Rate Limiting

- Testar que 6a tentativa de login em 1 min retorna 429
- Testar que response inclui `Retry-After` header

### ADMIN_SECRET

- Testar que app não inicia sem ADMIN_SECRET configurado
- Testar que valor com "changeme" é rejeitado

### Refresh Token Rotation

- Testar fluxo normal: refresh retorna novo par (access + refresh)
- Testar que token antigo é revogado após uso
- Testar detecção de roubo: reusar token revogado → 401 + todos tokens invalidados
- Testar que frontend salva novo refresh token

### .dockerignore

- Testar que build Docker não inclui `.env` ou `.git`

### Security Headers

- Testar que responses da API incluem X-Frame-Options, X-Content-Type-Options
- Testar que Nginx retorna headers de segurança

---

## Ordem de Implementação

1. ADMIN_SECRET (menor risco, mudança isolada)
2. Rate Limiting (dependência nova + configuração)
3. Security Headers / Helmet (dependência nova + configuração)
4. .dockerignore + PostgreSQL Secret (infra)
5. Refresh Token Rotation (mais complexo, afeta frontend e backend)
