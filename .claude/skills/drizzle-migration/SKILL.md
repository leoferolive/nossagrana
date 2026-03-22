---
name: drizzle-migration
description: Alterar schema Drizzle → gerar migration → revisar SQL → validar
autoApply: false
---

# Drizzle Migration

Workflow para alterações no banco de dados via Drizzle ORM.

## Input

- `$DESCRIPTION` — descrição da alteração (ex: "adicionar tabela de tags")

## Passos

### 1. Alterar Schema

Editar `apps/api/src/db/schema.ts`:

```typescript
// Exemplo: nova tabela
export const tags = pgTable('tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  familiaId: uuid('familia_id').notNull().references(() => familias.id),
  nome: varchar('nome', { length: 100 }).notNull(),
  cor: varchar('cor', { length: 7 }).notNull(), // hex color
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Regras do schema:**
- `snake_case` para tabelas e colunas
- UUID como PK com `defaultRandom()`
- `familia_id` em toda tabela de dados financeiros
- `NOT NULL` por padrão
- `decimal` para valores monetários (nunca float)
- `timestamps` com `defaultNow()`

### 2. Gerar Migration

```bash
pnpm --filter api db:generate
```

Isso cria um arquivo SQL em `apps/api/src/db/migrations/`.

### 3. Revisar SQL Gerado

Ler o arquivo de migration gerado e verificar:

- [ ] Tabelas e colunas em `snake_case`
- [ ] Foreign keys corretas
- [ ] Índices necessários estão presentes
- [ ] Sem `CASCADE` em deletes de tabelas financeiras
- [ ] NOT NULL onde necessário
- [ ] Defaults corretos

### 4. Adicionar Índices (se necessário)

Para queries frequentes no Raspberry Pi, adicionar índices compostos:

```typescript
// No schema.ts, após a definição da tabela
export const tagsIdx = {
  familiaIdx: index('idx_tags_familia').on(tags.familiaId),
};
```

Priorizar:
- `(familia_id)` — toda tabela multi-tenant
- `(familia_id, campo_filtrado)` — para queries com WHERE adicional
- Índices parciais quando filtro é comum

### 5. Aplicar Migration

```bash
pnpm --filter api db:migrate
```

### 6. Validar

```bash
# Type-check para garantir que o schema está correto
pnpm --filter api type-check

# Testes para garantir que nada quebrou
pnpm --filter api test
```

## Rollback

Se a migration precisa ser revertida:

1. Criar nova migration que desfaz as alterações
2. **Nunca** deletar arquivos de migration já aplicados
3. **Nunca** editar migrations já aplicadas
