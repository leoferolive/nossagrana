# Fixture PostgreSQL de duas famílias (issue #80)

Factory TypeScript sobre PostgreSQL descartável para provar isolamento multi-tenant
com constraints e joins reais.

## Uso

```ts
import { criarCenarioDuasFamilias } from './cenario-duas-familias.js';
import { cabecalhosAutenticados } from './credenciais-teste.js';

const cenario = await criarCenarioDuasFamilias(); // banco novo + migrations + dados
const { banco, familiaA, familiaB } = cenario;
// familiaA.familiaId, .admin, .membro, .categoriaId, .metodoPagamentoId, .transacaoIds
const headers = cabecalhosAutenticados(app, familiaA.admin, familiaA.familiaId);
await cenario.descartar(); // teardown (afterEach/afterAll)
```

- Cada cenário cria **um banco próprio** (`ng_test_<uuid>`) a partir de `PG_TEST_ADMIN_URL`
  (harness `pg-harness.ts`). Isso isola por construção: testes e workers paralelos não
  colidem, sem depender de ordem nem de limpeza de tabelas.
- Falha de migration derruba o banco criado e lança `Falha ao aplicar migrations no banco
de teste <nome>: <causa>` — o setup nunca segue com schema parcial.
- `credenciais-teste.ts` emite o token pelo `app.jwt.sign` do próprio app (sem segredo
  duplicado) e monta `authorization` + `x-familia-id` para `app.inject`. Para testar
  ownership, passe de propósito o `familiaId` de outra família.
- `vitest.pg.setup.ts` define env fictício só para os imports (o `db` global nunca conecta).
- Nenhuma credencial real: e-mails `@example.test` com sufixo único e hash fictício.

## Posse de família contra o banco da fixture

`cenario-duas-familias.http.pg.test.ts` monta
`buildApp({ verificadorAcessoFamilia: new DrizzleVerificadorAcessoFamilia(drizzle(cenario.banco.sql)) })`:
o verificador real consulta o banco do cenário (conexão controlada e fechada pelo cenário).
Admin/membro passam, e quem forja o `x-familia-id` de outra família recebe 403
`FAMILIA_SEM_ACESSO`. Atenção: com NODE_ENV=test as rotas HTTP usam repositórios InMemory,
então o 200 prova a posse (prehandler), não os dados — isolamento de dados é provado nos
testes de repositório Drizzle em `cenario-duas-familias.pg.test.ts`.

## Rodar

```bash
bash scripts/test-pg.sh   # sobe postgres:17-alpine descartável e roda `test:pg`
```
