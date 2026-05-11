---
name: code-quality-guard
description: Regras de qualidade de código que DEVEM ser seguidas durante a escrita para evitar reprovação na CI — autoApply em toda implementação
autoApply: true
---

# Code Quality Guard

Regras a seguir **enquanto escreve código**, não apenas antes do commit. Previne erros que a CI captura.

## Regra 1: Schema Fastify = Contrato TypeScript

Toda rota Fastify com `reply.code(N)` DEVE ter esse código no `schema.response`:

```typescript
// ERRADO — TS2345: '400' not assignable to '200 | 404'
schema: {
  response: { 200: successSchema, 404: errorSchema }
}
// ... handler faz reply.code(400) → FALHA no type-check

// CERTO
schema: {
  response: { 200: successSchema, 400: errorSchema, 404: errorSchema }
}
```

**Ao adicionar um novo error handler com `reply.code(N)`, imediatamente adicione N ao schema.**

## Regra 2: Non-null assertions (`!`) são code smells

Nunca usar `value!` para silenciar null. Sempre adicionar guard explícito:

```typescript
// ERRADO — crash em runtime se categoriaId for null
categoriaId: template.categoriaId!,

// CERTO — erro controlado
if (!template.categoriaId) throw new TemplateSemCategoriaError();
categoriaId: template.categoriaId, // TS sabe que não é null
```

## Regra 3: Imports de @nossagrana/types

Ao criar novos schemas/tipos em `packages/types/src/`:

1. Exportar no `packages/types/src/index.ts`
2. Rodar `pnpm --filter @nossagrana/types build` antes de importar em `api` ou `web`

## Regra 4: Separador decimal pt-BR

Inputs numéricos no frontend usam vírgula (`0,00`). A API espera ponto (`0.00`). Sempre normalizar antes de enviar:

```typescript
valor.replace(',', '.');
```

## Regra 5: tsconfig include/exclude

Arquivos em `src/scripts/` que usem dependências opcionais devem ser excluídos do tsconfig principal ou ter suas dependências instaladas. Nunca deixar arquivos com erros de tipo no escopo do `include`.

## Regra 6: Knip — código morto

- Não exportar classes/funções que só são usadas internamente no módulo
- Remover imports não usados imediatamente
- Se um export é necessário mas knip não detecta (ex: plugin Fastify), adicionar ao `knip.config.ts`

## Regra 7: Prettier

Usar Prettier integrado. Se criar/modificar arquivos, formatar antes de commitar:

```bash
pnpm exec prettier --write <arquivo>
```

## Regra 8: Complexidade

ESLint reporta (warn) funções com:

- `complexity` (ciclomática) > 10
- `cognitive-complexity` > 15
- `max-lines-per-function` > 50
- `max-depth` > 4
- `max-params` > 5

Warnings não quebram o lint, mas o **ratchet** (`pnpm quality` etapa final) falha se o número total de violações aumentar.

**Ao escrever uma função nova:**

- Prefira early-returns sobre `else` aninhado.
- Extraia condicionais complexas em funções nomeadas.
- Use objetos de configuração quando precisar de mais de 5 parâmetros.

**Refatorações que ajudam:**

- `if (!x) return; ...` em vez de `if (x) { ... }`.
- Helpers privados no mesmo arquivo (não exportados) — Knip não reclama.
- Substituir `switch` longos por dicionários (`Record<K, fn>`).

## Checklist Mental por Arquivo

Ao terminar de editar qualquer arquivo, verificar mentalmente:

- [ ] Todos os `reply.code(N)` têm N no schema?
- [ ] Nenhum `!` non-null assertion sem guard?
- [ ] Imports usados? Nenhum import morto?
- [ ] Tipos explícitos (sem `any`)?
- [ ] Valores decimais normalizados (vírgula → ponto)?
- [ ] Arquivo formatado com Prettier?
- [ ] Funções com ≤ 10 de complexidade ciclomática? ≤ 50 linhas?
