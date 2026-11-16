# Nova UI — Entrega 2, PR 3 (E2E ajustados): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fazer os 29 testes E2E (`apps/e2e/tests/`, seis specs) voltarem a
passar contra o app com a navegação nova, e deixar documentado como rodá-los.

**Architecture:** só `apps/e2e` e documentos. Os specs passam a navegar pelos
endereços de `apps/web/src/routes/caminhos.ts` e pelos nomes acessíveis da
navegação nova. Os testes não rodam no CI; rodam à mão contra o ambiente
isolado, onde a API tem limite de requisições ligado (3 cadastros e 5 logins
por minuto), então a suíte precisa caber nesse limite.

**Tech Stack:** Playwright (`@playwright/test`), fixtures próprias em
`apps/e2e/fixtures/base.ts`, auxiliares em `apps/e2e/helpers/`.

**Spec:** `docs/superpowers/specs/2026-11-16-nova-ui-entrega-2-design.md`
(objetivo 6 e "Como sai", item 3).

## Global Constraints

- **Nenhuma mudança em `apps/web`, `apps/api` nem `packages/types`.** Se um
  teste revelar defeito do app, o teste fica marcado com `test.fixme` e um
  comentário com o defeito, e o defeito vai para o relatório. Não se conserta o
  app neste PR nem se enfraquece o teste para passar.
- O limite de requisições da API não é contornado: o servidor recusa
  `NODE_ENV=test` de propósito. A suíte se adapta a ele.
- Preferir `getByRole` e `getByLabel` a `getByText`. Nomes acessíveis com
  acento, como no app.
- Usar as fixtures do projeto (`authContext`, `familiaId`, `authenticatedPage`)
  e `import { test, expect } from '../fixtures/base.js'`.
- Cada teste continua independente e repetível: cria os próprios dados, não
  depende de ordem.
- Fluxo de commit: `git add <arquivos>` → `pnpm exec prettier --write <arquivos>`
  → `git add <arquivos>` → `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality`
  → `git commit`. Nunca `git add -A` nem `--no-verify`.

## O que mudou no app e quebra os specs

| Antes                                                                        | Agora                                                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Telas sem endereço, navegação por cliques                                    | Toda tela tem endereço; dá para abrir direto com `page.goto(caminho)` |
| Barra: "Ver dashboard", "Ver extrato", "Ver relatórios", "Ver configurações" | Barra: Início, Extrato, "Lançar", Planejar, Mais (links)              |
| Botão flutuante "Nova transação"                                             | Botão "Lançar" na barra                                               |
| Tela Configurações                                                           | Tela Mais (`/mais`), com grupos e links                               |
| Texto "Como deseja entrar…" no onboarding                                    | Não existe mais; conferir o texto atual da tela                       |
| `<select>` nativo em categoria e pagamento                                   | `CustomSelect` (botão que abre lista de opções)                       |
| Rótulos sem acento ("Nome da familia")                                       | Rótulos com acento ("Nome da família")                                |
| Oito tours por tela                                                          | Um tour de boas-vindas (chave `tour-boas-vindas` no `localStorage`)   |
| Títulos "Lançamentos do Mês", "Orçamento Mensal", "Cartões e Pagamentos"     | "Contas do mês", "Limites por categoria", "Métodos de pagamento"      |

## Review Focus

1. **Suíte inteira em sequência:** os 29 testes passam numa única execução, sem
   estourar o limite de cadastros e logins.
2. **Repetição:** rodar a suíte duas vezes seguidas dá o mesmo resultado (sem
   dado sobrando de uma execução para a outra).
3. **Teste que passa pelo motivo errado:** nenhum teste trocou uma afirmação
   forte por uma fraca só para ficar verde.
4. **Tour:** o tour de boas-vindas não cobre os elementos que os testes clicam.
5. **Defeito do app encontrado pelo caminho:** está em `test.fixme` com o
   motivo, e no relatório.

---

### Task 1: Ritmo da suíte dentro do limite de requisições

**Files:**

- Modify: `apps/e2e/playwright.config.ts`, `apps/e2e/fixtures/base.ts`,
  `apps/e2e/helpers/session.ts`
- Create: `apps/e2e/README.md`

- [ ] **Step 1: Medir.** Com o ambiente isolado no ar, contar quantos cadastros
      e logins cada teste faz hoje (fixtures e chamadas diretas nos specs).
- [ ] **Step 2: Reduzir e espaçar.** `workers: 1`. As fixtures passam a
      reaproveitar o que puderem sem perder a independência dos testes (por
      exemplo, um login por teste em vez de dois). O que sobrar acima do limite
      é resolvido com uma espera entre testes, calculada a partir do limite
      (3 cadastros por minuto), ligada por padrão e ajustável pela variável de
      ambiente `E2E_PAUSA_MS`.
- [ ] **Step 3: Suprimir o tour novo** nas páginas autenticadas dos testes
      (chave `tour-boas-vindas`), no lugar das chaves dos tours antigos.
- [ ] **Step 4: Escrever `apps/e2e/README.md`:** como subir o ambiente isolado
      (remete ao `docs/nova-ui/README.md`), as variáveis `BASE_URL` e `API_URL`,
      o comando para rodar tudo e para rodar um spec, quanto tempo a suíte leva
      e por quê.
- [ ] **Step 5: Commit** `test(e2e): suíte no ritmo do limite de requisições`.

### Task 2: Specs ajustados à navegação nova

**Files:**

- Modify: os seis specs de `apps/e2e/tests/` e, se preciso, `apps/e2e/helpers/`

Um spec por vez, nesta ordem: `auth`, `onboarding`, `familia`, `transacoes`,
`orcamento`, `relatorios`.

- [ ] **Step 1: Rodar o spec e anotar cada falha** com a causa (linha da tabela
      acima ou outra).
- [ ] **Step 2: Ajustar** seletores, endereços e fluxos. Criar em
      `apps/e2e/helpers/` um auxiliar para escolher opção no `CustomSelect` e
      outro para abrir o painel de lançar, em vez de repetir os passos em cada
      teste.
- [ ] **Step 3: Rodar o spec até passar inteiro,** e uma segunda vez para
      confirmar que se repete.
- [ ] **Step 4: Commit por spec** `test(e2e): <spec> na navegação nova`.

### Task 3: Suíte inteira e fechamento

- [ ] **Step 1: Rodar os 29 testes em sequência, duas vezes.** Registrar o
      tempo e o resultado de cada execução.
- [ ] **Step 2: Marcar a caixa** "E2E ajustados à nova navegação" no Checkpoint
      de `docs/nova-ui/README.md`, tirar dela a nota sobre os specs quebrados e
      acrescentar a linha no Diário. Atualizar em "Ambiente para validar no
      navegador" a parte sobre o E2E, apontando para `apps/e2e/README.md`.
- [ ] **Step 3: Commit** `docs(web): E2E da nova navegação e como rodar`.
