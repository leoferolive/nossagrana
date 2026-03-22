# API Design

## Rotas

- Path em `kebab-case`: `/metodos-pagamento`, `/categorias`
- Verbos REST: `GET` (listar/detalhar), `POST` (criar), `PUT` (atualizar completo), `PATCH` (atualizar parcial), `DELETE` (remover)
- Prefixo de módulo: `/auth`, `/familias`, `/transacoes`, `/categorias`, etc.

## Response Format

```typescript
// Sucesso (lista)
{ data: T[], meta?: { total: number, page: number } }

// Sucesso (item)
{ data: T }

// Erro
{ error: { message: string, code?: string } }
```

## Headers

- `Content-Type: application/json`
- `Authorization: Bearer <token>` para rotas protegidas

## Registro de Módulos

Todo novo módulo deve ser registrado em `apps/api/src/app.ts`:

```typescript
import { moduloRoutes } from './modules/modulo/modulo.routes.js';

app.register(moduloRoutes, { prefix: '/modulo' });
```

## Schema Zod nas Rotas

Toda rota Fastify deve declarar schemas de validação:

```typescript
{
  schema: {
    body: createModuloSchema,
    response: {
      200: moduloResponseSchema,
    },
  },
}
```

## Paginação

Para endpoints que retornam listas:

- Query params: `?page=1&limit=20`
- Limite máximo: 100 itens por página
- Resposta inclui `meta` com total e página atual
