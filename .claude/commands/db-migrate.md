Gere uma migration Drizzle para: "$ARGUMENTS"

Use a skill `drizzle-migration` para guiar o processo. Passos:

### 1. Alterar Schema

Editar `apps/api/src/db/schema.ts` com as alterações necessárias.

Regras:

- Tabelas e colunas em `snake_case`
- UUID como PK com `defaultRandom()`
- `familia_id` em tabelas de dados financeiros
- `NOT NULL` por padrão
- `decimal` para valores monetários
- Timestamps com `defaultNow()`

### 2. Gerar Migration

```bash
pnpm --filter api db:generate
```

### 3. Revisar SQL

Ler o arquivo de migration gerado e verificar:

- Nomes corretos em `snake_case`
- Foreign keys
- Índices necessários
- Sem CASCADE em deletes financeiros

### 4. Adicionar Índices

Se necessário, adicionar índices compostos para performance no Raspberry Pi:

- `(familia_id)` em toda tabela multi-tenant
- `(familia_id, campo_filtrado)` para queries frequentes

### 5. Aplicar Migration

```bash
pnpm --filter api db:migrate
```

### 6. Validar

```bash
pnpm --filter api type-check && pnpm --filter api test
```
