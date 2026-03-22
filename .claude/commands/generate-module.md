Gere um módulo backend Fastify completo chamado "$ARGUMENTS" seguindo TDD.

Use a skill `generate-module` para guiar a implementação. Siga todos os 9 passos:

1. Criar types com interfaces do domínio
2. Escrever testes RED do repository (incluindo isolamento multi-tenant)
3. Implementar repository com Drizzle (GREEN)
4. Escrever testes RED do service
5. Implementar service (GREEN)
6. Criar schemas Zod para validação
7. Implementar routes Fastify
8. Registrar módulo em `apps/api/src/app.ts`
9. Rodar validação completa (`pnpm --filter api test && pnpm type-check && pnpm lint:fast`)

Consulte módulos existentes em `apps/api/src/modules/` como referência para padrões.
Toda query DEVE filtrar por `familia_id` para isolamento multi-tenant.
