Rode os testes do projeto e analise os resultados.

Padrão de filtro: "$ARGUMENTS"

## IMPORTANTE: Web Tests Obrigatórios

Os testes web (apps/web) NÃO rodam no CI (travam no Pi ARM64).
Por isso, DEVEM ser rodados localmente antes de qualquer commit.

## Execução

Se um padrão foi fornecido, rode apenas os testes que matcham:

```bash
pnpm test -- $ARGUMENTS
```

Se nenhum padrão foi fornecido, rode TODOS os testes (API + Web):

```bash
# 1. Build types (dependência dos testes)
pnpm --filter @nossagrana/types build

# 2. API tests
pnpm --filter api test -- --run

# 3. Web tests (OBRIGATÓRIO — não roda no CI)
pnpm --filter web test -- --run
```

## Análise de Resultados

Após rodar os testes:

1. **Se todos passaram**: reportar resumo (total de testes, suítes, tempo)
2. **Se algum falhou**: para cada falha:
   - Identificar o arquivo e teste que falhou
   - Ler o código do teste e da implementação
   - Diagnosticar a causa raiz
   - Sugerir correção específica
3. **Cobertura**: se solicitado, rodar `pnpm test:coverage` e analisar

## Dicas

- Se testes de `api` falharem por tipos, verificar se `packages/types` precisa de build: `pnpm --filter @nossagrana/types build`
- Se testes de `web` falharem por import, verificar mocks e paths
- Para testes E2E: `pnpm --filter e2e test`
- Web tests usam pool `forks` com maxForks=4 localmente — se travar, matar processos vitest e tentar com menos forks
