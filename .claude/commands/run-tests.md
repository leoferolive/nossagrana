Rode os testes do projeto e analise os resultados.

Padrão de filtro: "$ARGUMENTS"

## Execução

Se um padrão foi fornecido, rode apenas os testes que matcham:

```bash
pnpm test -- $ARGUMENTS
```

Se nenhum padrão foi fornecido, rode todos os testes:

```bash
pnpm test
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
