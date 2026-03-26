# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as 5 vulnerabilidades de segurança mais críticas identificadas na auditoria de 2026-03-25.

**Architecture:** Cada task é independente e pode ser implementada, testada e commitada isoladamente. A ordem minimiza risco: começa com mudanças de configuração, depois dependências novas, infra, e por fim a mais complexa (refresh token rotation que afeta backend + frontend + schema).

**Tech Stack:** Fastify, @fastify/rate-limit, @fastify/helmet, Drizzle ORM, Zod, React, nginx

**Spec:** `docs/superpowers/specs/2026-03-25-security-hardening-design.md`

---

### Task 1: ADMIN_SECRET Obrigatório + Fortalecer JWT Secrets

**Files:**

- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/vitest.setup.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Atualizar vitest.setup.ts com secrets válidos**

Adicionar `ADMIN_SECRET` e aumentar tamanho dos JWT secrets para >= 32 chars:

```typescript
// apps/api/vitest.setup.ts
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-chars!';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-32-chars-ok!';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.ADMIN_SECRET = 'test-admin-secret-with-32-chars!!';
```

- [ ] **Step 2: Alterar env.ts para tornar secrets obrigatórios e fortes**

```typescript
// apps/api/src/config/env.ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  ADMIN_SECRET: z
    .string()
    .min(32)
    .refine((val) => !val.includes('changeme'), {
      message: 'ADMIN_SECRET não pode conter "changeme". Defina um valor seguro.',
    }),
});
```

- [ ] **Step 3: Atualizar .env.example**

```bash
# apps/api/.env.example
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://nossagrana:nossagrana@localhost:5432/nossagrana
JWT_SECRET=change-me-to-at-least-32-characters!!
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=change-me-to-at-least-32-characters!!
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
# Mínimo 32 caracteres, não pode conter "changeme"
ADMIN_SECRET=generate-a-strong-secret-here-min-32
```

- [ ] **Step 4: Atualizar .env local de dev**

O `.env` local precisa ter secrets com >= 32 chars. Atualizar `JWT_SECRET`, `REFRESH_TOKEN_SECRET` e `ADMIN_SECRET` no arquivo `apps/api/.env`.

- [ ] **Step 5: Rodar testes para verificar**

Run: `pnpm --filter api test -- --run`
Expected: PASS — todos os testes existentes devem passar com os novos valores de setup.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/vitest.setup.ts apps/api/.env.example
git commit -m "fix(security): tornar ADMIN_SECRET obrigatório e fortalecer JWT secrets

- Remover default inseguro 'changeme-admin-secret' do ADMIN_SECRET
- Aumentar mínimo de JWT_SECRET e REFRESH_TOKEN_SECRET de 8 para 32 chars
- Adicionar .refine() que rejeita valores contendo 'changeme'
- Atualizar vitest.setup.ts com valores válidos"
```

---

### Task 2: Rate Limiting

**Files:**

- Modify: `apps/api/package.json` (via pnpm add)
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `apps/api/src/modules/admin/admin.routes.ts`

- [ ] **Step 1: Instalar dependência**

Run: `pnpm --filter api add @fastify/rate-limit`

- [ ] **Step 2: Configurar trustProxy + rate limiting global em app.ts**

Adicionar `trustProxy: true` ao Fastify e registrar o plugin de rate limit:

```typescript
// apps/api/src/app.ts — no buildApp()
export const buildApp = () => {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Rate limiting global: 100 req/min por IP
  app.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    allowList: (req) => req.url === '/api/health',
    errorResponseBuilder: (_req, context) => ({
      error: {
        message: `Muitas tentativas. Tente novamente em ${Math.ceil(context.ttl / 1000)} segundos.`,
      },
    }),
  });

  app.register(import('@fastify/cors'), {
    // ... restante igual
```

- [ ] **Step 3: Adicionar rate limiting específico nas rotas de auth**

Em `apps/api/src/modules/auth/auth.routes.ts`, adicionar `config` com rate limit por rota:

```typescript
// POST /auth/login
fastify.post(
  '/auth/login',
  {
    schema: authLoginSchema,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  },
  async (request, reply) => {
    // ... handler igual
  },
);

// POST /auth/register
fastify.post(
  '/auth/register',
  {
    schema: authRegisterSchema,
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  },
  async (request, reply) => {
    // ... handler igual
  },
);

// POST /auth/refresh
fastify.post(
  '/auth/refresh',
  {
    schema: authRefreshSchema,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  },
  async (request, reply) => {
    // ... handler igual
  },
);
```

- [ ] **Step 4: Adicionar rate limiting nas rotas admin**

Em `apps/api/src/modules/admin/admin.routes.ts`, adicionar `config` nas duas rotas:

```typescript
// PATCH /admin/familias/:familiaId/recuperar
fastify.patch(
  '/admin/familias/:familiaId/recuperar',
  {
    preHandler: [requireAdmin],
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    schema: {
      /* ... igual */
    },
  },
  async (request, reply) => {
    /* ... */
  },
);

// POST /admin/usuarios/:userId/impersonar
fastify.post(
  '/admin/usuarios/:userId/impersonar',
  {
    preHandler: [requireAdmin],
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    schema: {
      /* ... igual */
    },
  },
  async (request, reply) => {
    /* ... */
  },
);
```

- [ ] **Step 5: Rodar testes**

Run: `pnpm --filter api test -- --run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/app.ts apps/api/src/modules/auth/auth.routes.ts apps/api/src/modules/admin/admin.routes.ts
git commit -m "fix(security): adicionar rate limiting global e por rota

- Instalar @fastify/rate-limit
- Rate limit global: 100 req/min por IP
- Login: 5/min, Register: 3/min, Refresh: 10/min, Admin: 3/min
- Configurar trustProxy para IP real atrás de proxy
- Excluir /api/health do rate limiting (K8s probes)"
```

---

### Task 3: Security Headers (Helmet + Nginx)

**Files:**

- Modify: `apps/api/package.json` (via pnpm add)
- Modify: `apps/api/src/app.ts`
- Modify: `apps/web/nginx.conf`

- [ ] **Step 1: Instalar dependência**

Run: `pnpm --filter api add @fastify/helmet`

- [ ] **Step 2: Registrar Helmet no app.ts (sem CSP — API não serve HTML)**

Adicionar após o registro do CORS em `apps/api/src/app.ts`:

```typescript
app.register(import('@fastify/helmet'), {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});
```

- [ ] **Step 3: Reescrever nginx.conf com security headers + CSP**

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
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:;" always;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /health {
    default_type text/plain;
    return 200 'ok';
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter api test -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/app.ts apps/web/nginx.conf
git commit -m "fix(security): adicionar security headers via Helmet e nginx

- @fastify/helmet sem CSP (API é JSON puro)
- nginx.conf com CSP, X-Frame-Options, X-Content-Type-Options
- server_tokens off para esconder versão do nginx
- Corrigir /health location para usar default_type"
```

---

### Task 4: .dockerignore + PostgreSQL Secret

**Files:**

- Create: `.dockerignore`
- Modify: `k8s/postgres/statefulset.yaml`
- Create: `k8s/postgres/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Criar .dockerignore na raiz**

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

- [ ] **Step 2: Remover Secret hardcoded do statefulset.yaml**

Remover as linhas 1-10 (o objeto Secret com stringData). Manter apenas o StatefulSet e Service. O StatefulSet já referencia `nossagrana-postgres-secrets` via `envFrom.secretRef`.

O arquivo deve ficar assim (apenas StatefulSet + Service):

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: nossagrana-postgres
  namespace: nossagrana
spec:
  serviceName: nossagrana-postgres
  replicas: 1
  selector:
    matchLabels:
      app: nossagrana-postgres
  template:
    metadata:
      labels:
        app: nossagrana-postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16
          ports:
            - containerPort: 5432
          envFrom:
            - secretRef:
                name: nossagrana-postgres-secrets
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          readinessProbe:
            exec:
              command:
                - sh
                - -c
                - pg_isready -U "$POSTGRES_USER"
            initialDelaySeconds: 10
            periodSeconds: 10
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: nossagrana-postgres
  namespace: nossagrana
spec:
  selector:
    app: nossagrana-postgres
  ports:
    - port: 5432
      targetPort: 5432
```

- [ ] **Step 3: Criar README com instruções para secret**

Criar `k8s/postgres/README.md`:

````markdown
# PostgreSQL — NossaGrana

## Criar Secret (obrigatório antes do primeiro deploy)

O secret `nossagrana-postgres-secrets` deve ser criado manualmente no cluster.
**Nunca** commitar o secret no repositório.

```bash
kubectl create secret generic nossagrana-postgres-secrets \
  --namespace nossagrana \
  --from-literal=POSTGRES_USER=nossagrana \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=POSTGRES_DB=nossagrana
```
````

## Verificar secret existente

```bash
kubectl get secret nossagrana-postgres-secrets -n nossagrana -o yaml
```

```

- [ ] **Step 4: Criar o secret real no cluster via kubectl**

Run: `kubectl create secret generic nossagrana-postgres-secrets --namespace nossagrana --from-literal=POSTGRES_USER=nossagrana --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) --from-literal=POSTGRES_DB=nossagrana --dry-run=client -o yaml | kubectl apply -f -`

**Nota:** Se o secret já existe, isso fará update. Se o PostgreSQL já está rodando com a senha antiga, será necessário atualizar a senha no banco também ou manter a senha atual. Verificar antes de aplicar.

- [ ] **Step 5: Atualizar .gitignore**

Substituir `k8s/secrets-real.yaml` por `k8s/**/secret*.yaml`:

```

# K8s secrets reais (nunca commitar)

k8s/\*_/secret_.yaml

````

- [ ] **Step 6: Commit**

```bash
git add .dockerignore k8s/postgres/statefulset.yaml k8s/postgres/README.md .gitignore
git commit -m "fix(security): criar .dockerignore e remover secret hardcoded do PostgreSQL

- .dockerignore evita copiar .env, .git, node_modules para imagem Docker
- Remover Secret com senha hardcoded do statefulset.yaml
- Criar README com instruções para criar secret manualmente
- Atualizar .gitignore com padrão mais abrangente para secrets K8s"
````

---

### Task 5: Refresh Token Rotation com Detecção de Roubo

Esta é a task mais complexa. Dividida em sub-tasks.

#### Task 5a: Schema Migration — adicionar userId à tabela revoked_refresh_tokens

**Files:**

- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Adicionar coluna userId à tabela revokedRefreshTokens**

Em `apps/api/src/db/schema.ts`, alterar a definição:

```typescript
export const revokedRefreshTokens = pgTable(
  'revoked_refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('revoked_refresh_tokens_token_hash_idx').on(table.tokenHash),
    index('revoked_refresh_tokens_user_id_idx').on(table.userId),
  ],
);
```

- [ ] **Step 2: Gerar migration Drizzle**

Run: `pnpm --filter api db:generate`
Expected: Nova migration criada em `apps/api/src/db/migrations/`

- [ ] **Step 3: Revisar SQL gerado**

Ler a migration gerada e verificar que contém:

- `ALTER TABLE revoked_refresh_tokens ADD COLUMN user_id UUID NOT NULL REFERENCES users(id)`
- `CREATE INDEX revoked_refresh_tokens_user_id_idx ON revoked_refresh_tokens (user_id)`

**Nota:** Se a tabela já tem dados sem `user_id`, a migration pode falhar. Nesse caso, a migration deve primeiro limpar a tabela (tokens revogados antigos podem ser descartados) ou adicionar a coluna como nullable e depois alterar. Avaliar o SQL gerado antes de aplicar.

- [ ] **Step 4: Aplicar migration**

Run: `pnpm --filter api db:migrate`
Expected: Migration aplicada com sucesso.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/
git commit -m "feat(db): adicionar user_id à tabela revoked_refresh_tokens

Migration para suportar revokeAllByUserId na detecção de roubo de refresh token."
```

#### Task 5b: Atualizar RevokedTokenRepository + testes (backend)

**Files:**

- Modify: `apps/api/src/modules/auth/revoked-token.repository.ts`
- Modify: `apps/api/src/modules/auth/revoked-token.repository.test.ts`
- Modify: `apps/api/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Atualizar testes existentes para nova assinatura com userId**

Todas as 7 chamadas a `revokeToken` nos testes existentes precisam do 3o argumento `userId`. Atualizar `revoked-token.repository.test.ts`:

```typescript
// Substituir TODAS as chamadas de revokeToken(hash, date) por revokeToken(hash, date, userId)
const testUserId = 'user-123';

// Exemplo — linha 17:
await repo.revokeToken(tokenHash, expiresAt, testUserId);

// Exemplo — linhas 26-27:
await repo.revokeToken(tokenHash, expiresAt, testUserId);
await repo.revokeToken(tokenHash, expiresAt, testUserId);

// Exemplo — linha 42:
await repo.revokeToken(tokenHash, expiresAt, testUserId);

// Exemplos — linhas 53-54:
await repo.revokeToken(expiredHash, new Date(Date.now() - 1000), testUserId);
await repo.revokeToken(validHash, new Date(Date.now() + 60 * 60 * 1000), testUserId);

// Exemplos — linhas 65, 76-78: mesma adição de testUserId como 3o arg
```

- [ ] **Step 2: Adicionar testes para revokeAllByUserId**

Adicionar ao `revoked-token.repository.test.ts`:

```typescript
describe('revokeAllByUserId', () => {
  it('deve revogar todos os tokens de um userId específico', async () => {
    const userA = 'user-a';
    const userB = 'user-b';
    const hashA1 = hashToken('token-a1');
    const hashA2 = hashToken('token-a2');
    const hashB1 = hashToken('token-b1');
    const future = new Date(Date.now() + 60 * 60 * 1000);

    await repo.revokeToken(hashA1, future, userA);
    await repo.revokeToken(hashA2, future, userA);
    await repo.revokeToken(hashB1, future, userB);

    await repo.revokeAllByUserId(userA);

    // Tokens do userA continuam revogados (is expected — they were already revoked)
    expect(await repo.isRevoked(hashA1)).toBe(true);
    expect(await repo.isRevoked(hashA2)).toBe(true);
    // Token do userB não é afetado
    expect(await repo.isRevoked(hashB1)).toBe(true);
  });

  it('deve marcar userId como comprometido para isUserCompromised', async () => {
    await repo.revokeAllByUserId('compromised-user');
    expect(await repo.isUserCompromised('compromised-user')).toBe(true);
    expect(await repo.isUserCompromised('safe-user')).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar testes para verificar que falham (RED)**

Run: `pnpm --filter api test -- --run -t "revokeAllByUserId"`
Expected: FAIL — métodos não existem ainda.

- [ ] **Step 4: Atualizar interface e implementações (GREEN)**

```typescript
// apps/api/src/modules/auth/revoked-token.repository.ts

export interface RevokedTokenRepository {
  revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
  isRevoked(tokenHash: string): Promise<boolean>;
  isUserCompromised(userId: string): Promise<boolean>;
  cleanupExpired(): Promise<number>;
}

export class DrizzleRevokedTokenRepository implements RevokedTokenRepository {
  async revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void> {
    await db
      .insert(revokedRefreshTokens)
      .values({ tokenHash, expiresAt, userId })
      .onConflictDoNothing({ target: revokedRefreshTokens.tokenHash });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    // Inserir marcador de "usuário comprometido" — token hash especial
    // que isUserCompromised verifica
    const markerHash = `__compromised__${userId}`;
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await db
      .insert(revokedRefreshTokens)
      .values({ tokenHash: markerHash, expiresAt: farFuture, userId })
      .onConflictDoNothing({ target: revokedRefreshTokens.tokenHash });
  }

  async isRevoked(tokenHash: string): Promise<boolean> {
    const [found] = await db
      .select({ id: revokedRefreshTokens.id })
      .from(revokedRefreshTokens)
      .where(eq(revokedRefreshTokens.tokenHash, tokenHash))
      .limit(1);
    return !!found;
  }

  async isUserCompromised(userId: string): Promise<boolean> {
    const markerHash = `__compromised__${userId}`;
    return this.isRevoked(markerHash);
  }

  async cleanupExpired(): Promise<number> {
    const deleted = await db
      .delete(revokedRefreshTokens)
      .where(lte(revokedRefreshTokens.expiresAt, new Date()))
      .returning({ id: revokedRefreshTokens.id });
    return deleted.length;
  }
}

export class InMemoryRevokedTokenRepository implements RevokedTokenRepository {
  private tokens = new Map<string, { expiresAt: Date; revokedAt: Date; userId: string }>();
  private compromisedUsers = new Set<string>();

  async revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void> {
    if (!this.tokens.has(tokenHash)) {
      this.tokens.set(tokenHash, { expiresAt, revokedAt: new Date(), userId });
    }
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    this.compromisedUsers.add(userId);
  }

  async isRevoked(tokenHash: string): Promise<boolean> {
    return this.tokens.has(tokenHash);
  }

  async isUserCompromised(userId: string): Promise<boolean> {
    return this.compromisedUsers.has(userId);
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [hash, { expiresAt }] of this.tokens.entries()) {
      if (expiresAt <= now) {
        this.tokens.delete(hash);
        count++;
      }
    }
    return count;
  }
}
```

- [ ] **Step 5: Rodar testes para verificar que passam (GREEN)**

Run: `pnpm --filter api test -- --run`
Expected: PASS — todos os testes incluindo os novos.

- [ ] **Step 6: Atualizar chamadas existentes de revokeToken em auth.routes.ts**

O `/auth/logout` precisa passar `userId` e o type do `verify<>` precisa incluir `sub`:

```typescript
// Dentro do handler de /auth/logout — alterar o tipo do verify:
const decodedToken = fastify.jwt.verify<{
  sub: string; // ADICIONADO
  tokenType?: string;
  exp?: number;
}>(payload.refreshToken, {
  key: env.REFRESH_TOKEN_SECRET,
});

// E a chamada de revokeToken:
await revokedTokenRepo.revokeToken(tokenHash, expiresAt, decodedToken.sub);
```

- [ ] **Step 7: Rodar testes novamente**

Run: `pnpm --filter api test -- --run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/auth/revoked-token.repository.ts apps/api/src/modules/auth/revoked-token.repository.test.ts apps/api/src/modules/auth/auth.routes.ts
git commit -m "feat(auth): atualizar RevokedTokenRepository com userId e detecção de roubo

- Interface revokeToken agora aceita userId obrigatório
- Adicionar revokeAllByUserId com marcador de compromisso
- Adicionar isUserCompromised para verificar usuário comprometido
- Atualizar InMemory e Drizzle implementations
- Atualizar testes existentes + novos testes
- Atualizar chamada em /auth/logout com tipo correto"
```

#### Task 5c: Atualizar shared types (packages/types)

**Files:**

- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Atualizar authRefreshResponseSchema**

Em `packages/types/src/index.ts`, alterar o schema de response do refresh para incluir `refreshToken`:

```typescript
export const authRefreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});
```

- [ ] **Step 2: Rebuild types package**

Run: `pnpm --filter @nossagrana/types build`
Expected: Build com sucesso.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): adicionar refreshToken ao authRefreshResponseSchema

Suporte a refresh token rotation — o endpoint agora retorna novo par de tokens."
```

#### Task 5d: Implementar rotation no endpoint /auth/refresh (backend)

**Files:**

- Modify: `apps/api/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Escrever teste para refresh token rotation**

O teste (em `auth.routes.test.ts` ou `auth.service.test.ts` existente) deve verificar:

1. POST `/auth/refresh` com token válido retorna `{ accessToken, refreshToken }` (novo par)
2. O refresh token antigo é revogado (usar novamente retorna 401)
3. Reuso de token revogado retorna 401 com `TOKEN_REUSE_DETECTED`

- [ ] **Step 2: Atualizar response schema 401 em auth.schema.ts**

O schema atual de 401 usa `z.literal('Refresh token invalido')`, que não permite o novo `code` field nem a mensagem de TOKEN_REUSE_DETECTED. Alterar em `apps/api/src/modules/auth/auth.schema.ts`:

```typescript
export const authRefreshSchema = {
  body: authRefreshRequestSchema,
  response: {
    200: authRefreshResponseSchema,
    401: z.object({
      message: z.string(),
      code: z.string().optional(),
    }),
  },
};
```

- [ ] **Step 3: Implementar rotation no handler de /auth/refresh**

```typescript
fastify.post(
  '/auth/refresh',
  {
    schema: authRefreshSchema,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  },
  async (request, reply) => {
    try {
      const payload = authRefreshRequestSchema.parse(request.body);
      const tokenHash = hashToken(payload.refreshToken);

      // Verificar se token específico foi revogado (reuso = roubo)
      const isRevoked = await revokedTokenRepo.isRevoked(tokenHash);
      if (isRevoked) {
        try {
          const decoded = fastify.jwt.verify<{ sub: string }>(payload.refreshToken, {
            key: env.REFRESH_TOKEN_SECRET,
          });
          await revokedTokenRepo.revokeAllByUserId(decoded.sub);
        } catch {
          // Token expirado/inválido — não conseguimos decodificar userId
        }
        return reply
          .code(401)
          .send({ message: 'Token reuse detected', code: 'TOKEN_REUSE_DETECTED' });
      }

      const decodedToken = fastify.jwt.verify<{
        sub: string;
        email: string;
        tokenType?: string;
        exp?: number;
      }>(payload.refreshToken, {
        key: env.REFRESH_TOKEN_SECRET,
      });

      if (decodedToken.tokenType !== 'refresh') {
        return reply.code(401).send({ message: 'Refresh token invalido' });
      }

      // Verificar se o userId foi marcado como comprometido
      const isCompromised = await revokedTokenRepo.isUserCompromised(decodedToken.sub);
      if (isCompromised) {
        return reply
          .code(401)
          .send({ message: 'Token reuse detected', code: 'TOKEN_REUSE_DETECTED' });
      }

      // Revogar o token atual ANTES de gerar o novo
      const expiresAtSeconds = decodedToken.exp ?? Math.floor(Date.now() / 1000);
      const expiresAt = new Date(expiresAtSeconds * 1000);
      await revokedTokenRepo.revokeToken(tokenHash, expiresAt, decodedToken.sub);

      // Gerar novo par
      const accessToken = fastify.jwt.sign({
        sub: decodedToken.sub,
        email: decodedToken.email,
      });

      const refreshToken = fastify.jwt.sign(
        {
          sub: decodedToken.sub,
          email: decodedToken.email,
          tokenType: 'refresh',
        },
        {
          expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
          key: env.REFRESH_TOKEN_SECRET,
        },
      );

      return reply.code(200).send({ accessToken, refreshToken });
    } catch {
      return reply.code(401).send({ message: 'Refresh token invalido' });
    }
  },
);
```

- [ ] **Step 4: Verificar response schema de 200**

O `authRefreshSchema` importa `authRefreshResponseSchema` de `@nossagrana/types`, que foi atualizado na Task 5c para incluir `refreshToken`. Com o build de types feito, o schema já está correto.

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter api test -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/auth.routes.ts apps/api/src/modules/auth/auth.schema.ts
git commit -m "feat(auth): implementar refresh token rotation com detecção de roubo

- /auth/refresh agora retorna novo par (accessToken + refreshToken)
- Token antigo é revogado após uso
- Reuso de token revogado retorna 401 TOKEN_REUSE_DETECTED
- Detecção de roubo tenta revogar todos tokens do userId"
```

#### Task 5e: Atualizar frontend para salvar novo refresh token

**Files:**

- Modify: `apps/web/src/services/api-client.ts`
- Modify: `apps/web/src/services/api-client.test.ts`
- Modify: `apps/web/src/contexts/auth-context-store.ts`
- Modify: `apps/web/src/contexts/auth-context.tsx`
- Modify: `apps/web/src/services/core-financeiro.service.ts`

- [ ] **Step 1: Atualizar testes do ApiClient primeiro (RED)**

Em `apps/web/src/services/api-client.test.ts`, adicionar `setRefreshToken` ao construtor e atualizar o mock do refresh response:

```typescript
// Em ambos os testes, adicionar setRefreshToken ao construtor do ApiClient:
const apiClient = new ApiClient({
  baseUrl: 'http://localhost:3000',
  fetchFn: fetchMock,
  getAccessToken: () => tokenState.accessToken,
  getRefreshToken: () => tokenState.refreshToken,
  setAccessToken: (accessToken) => {
    tokenState.accessToken = accessToken;
  },
  setRefreshToken: (refreshToken) => {
    tokenState.refreshToken = refreshToken;
  }, // NOVO
  clearSession: () => {
    tokenState.accessToken = null;
    tokenState.refreshToken = null;
  },
});

// No 1o teste ("renews access token"), atualizar o mock do refresh response (linha 29):
new Response(
  JSON.stringify({ accessToken: 'access-token-new', refreshToken: 'refresh-token-new' }),
  {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  },
);

// E adicionar assertion:
expect(tokenState.refreshToken).toBe('refresh-token-new');
```

Run: `pnpm --filter web test -- --run`
Expected: FAIL — `setRefreshToken` não existe ainda no ApiClient.

- [ ] **Step 2: Adicionar setRefreshToken ao ApiClient (GREEN)**

Em `apps/web/src/services/api-client.ts`:

```typescript
interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void; // NOVO
  clearSession: () => void;
}

export class ApiClient {
  // ... campos existentes
  private readonly setRefreshToken: (refreshToken: string) => void; // NOVO

  constructor(options: ApiClientOptions) {
    // ... existentes
    this.setRefreshToken = options.setRefreshToken; // NOVO
  }

  // No refreshAccessToken():
  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return false;
    }

    const payload: AuthRefreshRequest = { refreshToken };
    const response = await this.fetchFn(`${this.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.clearSession();
      return false;
    }

    const body = (await response.json()) as AuthRefreshResponse;
    this.setAccessToken(body.accessToken);
    this.setRefreshToken(body.refreshToken); // NOVO — salvar novo refresh token
    return true;
  }
}
```

- [ ] **Step 3: Atualizar AuthContextValue interface**

Em `apps/web/src/contexts/auth-context-store.ts`, adicionar `setRefreshToken`:

```typescript
export interface AuthContextValue {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  familiaIdAtiva: string | null;
  login: (session: AuthSession) => void;
  logout: () => void;
  setAccessToken: (accessToken: string) => void;
  setRefreshToken: (refreshToken: string) => void; // NOVO
  updateFamiliaIdAtiva: (familiaIdAtiva: string) => void;
}
```

- [ ] **Step 4: Adicionar setRefreshToken callback no AuthProvider**

Em `apps/web/src/contexts/auth-context.tsx`, adicionar callback `setRefreshToken` (análogo ao `setAccessToken` existente):

```typescript
const setRefreshToken = useCallback((refreshToken: string) => {
  setSession((currentSession) => {
    if (!currentSession) {
      return null;
    }
    return {
      ...currentSession,
      refreshToken,
    };
  });
}, []);
```

E incluir no `value` do `useMemo`:

```typescript
const value = useMemo<AuthContextValue>(
  () => ({
    isAuthenticated: session !== null,
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    familiaIdAtiva: session?.familiaIdAtiva ?? null,
    login,
    logout,
    setAccessToken,
    setRefreshToken, // NOVO
    updateFamiliaIdAtiva,
  }),
  [login, logout, session, setAccessToken, setRefreshToken, updateFamiliaIdAtiva],
);
```

**Nota:** O `auth-context.tsx` já sincroniza o session com localStorage via `useEffect`. Ao atualizar o session state com novo refreshToken, o localStorage será atualizado automaticamente.

- [ ] **Step 5: Atualizar lazyApiClient no core-financeiro.service.ts**

Em `apps/web/src/services/core-financeiro.service.ts`, adicionar `setRefreshToken`:

```typescript
const lazyApiClient = new ApiClient({
  baseUrl: typeof import.meta !== 'undefined' ? (import.meta.env.VITE_API_URL ?? '') : '',
  getAccessToken: () => readStoredSession().accessToken ?? null,
  getRefreshToken: () => readStoredSession().refreshToken ?? null,
  setAccessToken: (token: string) => {
    const session = readStoredSession();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, accessToken: token }));
  },
  setRefreshToken: (token: string) => {
    // NOVO
    const session = readStoredSession();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, refreshToken: token }));
  },
  clearSession: () => localStorage.removeItem(AUTH_STORAGE_KEY),
});
```

- [ ] **Step 6: Rodar testes frontend**

Run: `pnpm --filter web test -- --run`
Expected: PASS

- [ ] **Step 7: Rodar CI completo**

Run: `pnpm lint && pnpm type-check && pnpm build && pnpm test -- --run`
Expected: PASS — todos os checks do CI devem passar.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/services/api-client.ts apps/web/src/services/api-client.test.ts apps/web/src/contexts/auth-context-store.ts apps/web/src/contexts/auth-context.tsx apps/web/src/services/core-financeiro.service.ts
git commit -m "feat(web): atualizar frontend para refresh token rotation

- ApiClient agora salva novo refresh token recebido do backend
- AuthContextValue interface atualizada com setRefreshToken
- AuthProvider sincroniza novo refresh token com localStorage
- lazyApiClient no core-financeiro.service.ts atualizado
- Testes do ApiClient atualizados"
```

---

### Verificação Final

- [ ] **Step 1: Rodar simulação completa de CI**

```bash
pnpm lint
pnpm type-check
pnpm build
pnpm knip
pnpm test:coverage
```

Todos devem passar.

- [ ] **Step 2: Verificar que nenhum secret foi commitado**

Run: `git log --oneline --diff-filter=A -- '*.env' | head -5`
Expected: Nenhum resultado (nenhum .env commitado).

Run: `grep -r 'changeme' apps/api/src/config/env.ts`
Expected: Apenas o `.refine()` que rejeita o valor.
