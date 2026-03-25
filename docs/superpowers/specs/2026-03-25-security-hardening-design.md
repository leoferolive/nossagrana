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

### Rate Limiting Global

- Registrado em `app.ts` como plugin Fastify
- 100 req/min por IP
- Store em memória (single-instance no Raspberry Pi)

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
- `apps/api/src/app.ts` — registrar plugin global
- `apps/api/src/modules/auth/auth.routes.ts` — config por rota
- `apps/api/src/modules/admin/admin.routes.ts` — config por rota

---

## 2. ADMIN_SECRET Obrigatório

### Mudanças em `apps/api/src/config/env.ts`

- Remover `.default('changeme-admin-secret')`
- Alterar para `z.string().min(32)`
- Adicionar `.refine()` que rejeita valores contendo `changeme`

### Mudanças em `apps/api/.env.example`

- Adicionar `ADMIN_SECRET=` com comentário explicativo sobre mínimo 32 chars

### Impacto

- Desenvolvedor deve setar `ADMIN_SECRET` no `.env` local (mínimo 32 caracteres)
- Testes: `vitest.setup.ts` deve setar `process.env.ADMIN_SECRET` com valor válido

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

### Arquivos Afetados

**Backend:**

- `apps/api/src/modules/auth/revoked-token.repository.ts`
  - Adicionar `revokeAllByUserId(userId: string)`: revoga todos os tokens de um usuário
  - Adicionar `isRevoked(tokenHash: string): Promise<boolean>`: verifica se token específico está revogado
- `apps/api/src/modules/auth/auth.routes.ts`
  - Alterar endpoint `/auth/refresh` para implementar fluxo completo
  - Alterar response para incluir `refreshToken` além de `accessToken`
- `apps/api/src/modules/auth/auth.schema.ts`
  - Atualizar `authRefreshResponseSchema` para incluir campo `refreshToken`

**Frontend:**

- `apps/web/src/contexts/auth-context.tsx`
  - Atualizar lógica de refresh para salvar novo refresh token recebido
- `apps/web/src/services/core-financeiro.service.ts`
  - Atualizar lógica de refresh para salvar novo refresh token

### Detecção de Roubo

Se um refresh token já revogado for usado, significa que alguém (atacante ou usuário legítimo) está reutilizando um token antigo. A resposta é invalidar TODA a sessão do usuário, forçando re-login.

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
k8s/
docs/
audit-screenshots/
planilha/
.worktrees/
```

### PostgreSQL Secret

**Remover de `k8s/postgres/statefulset.yaml`:**

- Remover o objeto `Secret` com `stringData` hardcoded

**Atualizar StatefulSet:**

- Referenciar secret externo via `envFrom: [{ secretRef: { name: postgres-credentials } }]`

**Criar `k8s/postgres/README.md`:**

- Instruções para criar secret manualmente:
  ```bash
  kubectl create secret generic postgres-credentials \
    --from-literal=POSTGRES_USER=nossagrana \
    --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32)
  ```

**Atualizar `.gitignore`:**

- Adicionar `k8s/**/secret*.yaml`

---

## 5. Security Headers (Helmet + Nginx)

### API — `@fastify/helmet`

**Dependência:** `@fastify/helmet`

**Configuração em `app.ts`:**

```typescript
await app.register(import('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false, // necessário para PWA
});
```

### Nginx — `nginx.conf`

Adicionar dentro do bloco `server`:

```nginx
server_tokens off;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### Arquivos Afetados

- `apps/api/package.json` — adicionar `@fastify/helmet`
- `apps/api/src/app.ts` — registrar plugin
- `apps/web/nginx.conf` — adicionar headers

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
