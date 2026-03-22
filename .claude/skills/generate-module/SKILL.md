---
name: generate-module
description: Criar módulo Fastify completo com TDD — types, repository, service, schemas, routes
autoApply: false
---

# Generate Module

Gera um módulo backend Fastify completo seguindo TDD.

## Input

- `$MODULE_NAME` — nome do módulo em kebab-case (ex: `metodo-pagamento`)

## Passos (9 etapas TDD)

### 1. Types — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.types.ts`

Definir interfaces do domínio:

```typescript
export interface ModuleName {
  id: string;
  familiaId: string;
  // campos do domínio
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateModuleNameInput {
  familiaId: string;
  // campos obrigatórios para criação
}

export interface ModuleNameRepository {
  criar(input: CreateModuleNameInput): Promise<ModuleName>;
  listarPorFamilia(familiaId: string): Promise<ModuleName[]>;
  buscarPorId(id: string, familiaId: string): Promise<ModuleName | null>;
  atualizar(
    id: string,
    familiaId: string,
    input: Partial<CreateModuleNameInput>,
  ): Promise<ModuleName>;
  remover(id: string, familiaId: string): Promise<void>;
}
```

### 2. Repository InMemory — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.repository.test.ts`

Escrever testes RED:

- Criar item
- Listar por familia_id (isolamento multi-tenant)
- Buscar por ID
- Atualizar
- Remover
- **Teste de isolamento**: dados de familia-2 não aparecem para familia-1

### 3. Repository — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.repository.ts`

Implementar repository com Drizzle (GREEN):

- Toda query filtra por `familia_id`
- Usar tabela do schema Drizzle existente ou criar nova

### 4. Service Tests — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.service.test.ts`

Escrever testes RED do service:

- CRUD completo
- Validações de negócio
- Isolamento multi-tenant

### 5. Service — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.service.ts`

Implementar service (GREEN):

- Recebe repository via injeção
- Lógica de negócio aqui
- Repassa `familiaId` ao repository

### 6. Schemas Zod — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.schema.ts`

Criar schemas de validação:

```typescript
import { z } from 'zod';

export const createModuleNameSchema = z.object({
  /* campos */
});
export const updateModuleNameSchema = createModuleNameSchema.partial();
export const moduleNameParamsSchema = z.object({ id: z.string().uuid() });
```

### 7. Routes — `apps/api/src/modules/$MODULE_NAME/$MODULE_NAME.routes.ts`

Implementar rotas Fastify:

```typescript
import type { FastifyInstance } from 'fastify';

export async function moduleNameRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      schema: {
        /* ... */
      },
    },
    async (request, reply) => {
      /* ... */
    },
  );
  app.post(
    '/',
    {
      schema: {
        /* ... */
      },
    },
    async (request, reply) => {
      /* ... */
    },
  );
  // PUT, DELETE...
}
```

### 8. Register — `apps/api/src/app.ts`

Adicionar import e registro do módulo:

```typescript
import { moduleNameRoutes } from './modules/$MODULE_NAME/$MODULE_NAME.routes.js';
app.register(moduleNameRoutes, { prefix: '/$MODULE_NAME' });
```

### 9. Validate

Rodar validação completa:

```bash
pnpm --filter api test
pnpm type-check
pnpm lint:fast
```
