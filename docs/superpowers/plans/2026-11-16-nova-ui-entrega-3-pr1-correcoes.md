# Nova UI — Entrega 3, PR 1 (Correções): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os três defeitos do app achados ao ajustar os testes E2E:
limite de categoria duplicado na mesma vigência, lista de membros que não
recarrega ao aprovar uma solicitação, e erro 500 no lugar de 429 quando o
limite de requisições estoura.

**Architecture:** correções pontuais nos módulos existentes (`orcamento` e o
registro do `@fastify/rate-limit` na API; a tela da família no Web). Nenhuma
estrutura nova. Os dois testes E2E que marcam esses defeitos saem do
`test.fixme`.

**Tech Stack:** Fastify + Drizzle + PostgreSQL, Vitest com repositórios
InMemory (API); React + Vitest + Testing Library (Web); Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-11-16-nova-ui-entrega-3-design.md`
(seção "Correções (PR 1)" e "O que seria um fracasso").

## Global Constraints

- TDD: o teste falha antes da mudança de produção.
- Toda query filtra por `familia_id`; os testes de serviço conferem que dado de
  outra família não é tocado.
- Nenhum limite de outro mês é apagado nem alterado: o histórico de limites
  continua valendo.
- Formato de erro da API: `{ error: { message, code? } }`.
- Sem `any`. Mensagens em português, com acento.
- Um commit por tarefa. Fluxo: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`.
- Se houver migration: cabeçalho comentado no padrão da `0013`,
  `SET LOCAL lock_timeout = '5s'`, SQL que pode rodar duas vezes, e teste na
  suíte PostgreSQL (`bash scripts/test-pg.sh`).
- Cada tarefa acrescenta uma linha ao Diário de `docs/nova-ui/README.md`; a
  caixa "Correções…" do Checkpoint (Entrega 3) é marcada na última.

## Review Focus

1. **Limite editado duas vezes no mesmo mês:** continua existindo uma linha só
   para aquela vigência, com o último valor.
2. **Limite editado em mês novo:** o do mês anterior é encerrado e o histórico
   mostra os dois.
3. **Família vizinha com a mesma categoria por nome:** não é afetada.
4. **Rejeitar uma solicitação:** a lista de pendentes atualiza e a de membros
   não ganha ninguém.
5. **Resposta 429:** traz a mensagem em português no formato de erro da API e o
   cabeçalho `retry-after`.

---

### Task 1: Limite de categoria sem duplicar na mesma vigência

**Files:**

- Modify: `apps/api/src/modules/orcamento/orcamento.service.ts` (método `set`),
  `orcamento.repository.ts` (e o repositório InMemory)
- Test: `apps/api/src/modules/orcamento/orcamento.service.test.ts`,
  `orcamento.repository.test.ts`

**Hoje:** `set` encerra o limite aberto com `vigenciaFim` no mês anterior e
insere outro. Quando o aberto começou no mesmo mês da edição, o encerrado fica
com início e fim iguais, e a lista do mês mostra os dois.

**Regra nova:** se o limite aberto tem `vigenciaInicio` igual ao
`vigenciaInicio` pedido, o valor dele é atualizado no lugar, sem encerrar nem
inserir. Nos outros casos vale o comportamento de hoje.

- [ ] **Step 1: Escrever os testes que falham** no serviço: editar duas vezes
      no mesmo mês deixa uma linha com o último valor; editar em mês novo
      encerra o anterior e cria o novo (histórico com dois); a categoria de
      outra família não muda; categoria inativa com limite aberto continua
      podendo ser ajustada.
- [ ] **Step 2: Rodar e ver falhar.**
      `pnpm --filter api exec vitest run src/modules/orcamento`
- [ ] **Step 3: Implementar,** com um método de repositório para atualizar o
      valor do limite por `id` e `familiaId`.
- [ ] **Step 4: Dados já duplicados.** Conferir no schema se pode existir mais
      de um limite da mesma família e categoria cobrindo o mesmo mês. Se puder,
      escrever uma migration que, para cada grupo de mesma família, categoria e
      `vigencia_inicio`, mantém o mais recente (`criado_em`) e remove os
      demais, com teste na suíte PostgreSQL no padrão de
      `parcela-pai-valor-migration.pg.test.ts`. Limites de vigências
      diferentes não são tocados.
- [ ] **Step 5: Rodar e ver passar** a suíte da API (e a PostgreSQL, se houver
      migration).
- [ ] **Step 6: Commit** `fix(api): editar o limite na mesma vigência atualiza em vez de duplicar`.

### Task 2: Lista de membros atualizada ao revisar solicitação

**Files:**

- Modify: `apps/web/src/pages/family-settings-page.tsx`
- Test: `apps/web/src/pages/family-settings-page.test.tsx`

- [ ] **Step 1: Escrever os testes que falham:** depois de aprovar uma
      solicitação, o novo membro aparece na lista sem recarregar a página e a
      solicitação some dos pendentes; depois de rejeitar, a solicitação some e
      a lista de membros não muda; se a recarga dos membros falhar, a tela
      mostra o erro e mantém a lista anterior.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar:** depois de aprovar, buscar de novo os membros.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `fix(web): lista de membros atualiza ao aprovar solicitação`.

### Task 3: 429 quando o limite de requisições estoura

**Files:**

- Modify: `apps/api/src/app.ts` (registro do `@fastify/rate-limit`)
- Test: `apps/api/src/app.test.ts` ou um arquivo próprio ao lado

**Hoje:** o `errorResponseBuilder` devolve um objeto sem `statusCode`; o
Fastify o trata como resposta comum, a serialização contra o schema da rota
falha e sai um 500.

- [ ] **Step 1: Escrever o teste que falha:** com o limite ligado (o app de
      teste desliga o limite quando `NODE_ENV=test`; o teste precisa de uma
      instância com ele ligado e um limite baixo), a requisição que estoura o
      limite de `/api/auth/login` devolve 429, corpo
      `{ error: { message: 'Muitas tentativas. Tente novamente em N segundos.' } }`
      e cabeçalho `retry-after`.
- [ ] **Step 2: Rodar e ver falhar** (hoje sai 500).
- [ ] **Step 3: Implementar** do jeito que a documentação da versão instalada
      do `@fastify/rate-limit` indica para resposta personalizada com status
      429 (consultar a documentação da versão em `node_modules`, não a
      memória).
- [ ] **Step 4: Rodar e ver passar** a suíte da API.
- [ ] **Step 5: Commit** `fix(api): limite de requisições responde 429 em vez de 500`.

### Task 4: Testes E2E e fechamento

**Files:**

- Modify: `apps/e2e/tests/orcamento.spec.ts`, `apps/e2e/tests/familia.spec.ts`,
  `apps/e2e/README.md`, `docs/nova-ui/README.md`

- [ ] **Step 1: Tirar o `test.fixme`** de "editar o limite não duplica a
      categoria na lista" e de "aprovar solicitação mostra o novo membro sem
      recarregar".
- [ ] **Step 2: Rodar os dois specs** no ambiente isolado, no ritmo do
      `apps/e2e/README.md`. Esperado: todos passam, nenhum pulado nesses dois
      specs.
- [ ] **Step 3: Atualizar** os números no `apps/e2e/README.md` (31 passam, 1
      pulado), marcar a caixa "Correções…" no Checkpoint, tirar os três
      defeitos corrigidos da lista "Depois (sem data)" e acrescentar a linha no
      Diário.
- [ ] **Step 4: Commit** `test(e2e): limite e membros saem do fixme`.
