# Nova UI — Entrega 1, PR 2 (Base visual): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a base visual do `apps/web` para a direção da nova UI (paleta
clara, Manrope, altura de tela, área segura, toque, z-index, ícones), sem mudar a
navegação nem o desenho das telas.

**Architecture:** os nomes dos tokens Tailwind ficam e os valores mudam em
`src/index.css`, então a paleta vira de uma vez no app inteiro. O que hoje está
fixo fora dos tokens (cores de gráfico, sombras, classes de campo, z-index,
emojis) passa a ter uma única definição cada. Regras que não podem regredir
ganham teste ou regra de lint.

**Tech Stack:** React 19, Vite 6, Tailwind 3, Vitest + Testing Library,
vite-plugin-pwa, lucide-react, `@fontsource-variable/manrope` 5.x.

**Spec:** `docs/superpowers/specs/2026-11-15-nova-ui-entrega-1-design.md`
(seção "PR 2 — Base visual"). Sistema visual:
`docs/nova-ui/README.md` (seções "Decisões fechadas" e "Sistema visual").
Evidências: `docs/nova-ui/auditoria.md`.

## Global Constraints

- Só `apps/web` (mais `apps/e2e` onde um spec procura emoji ou símbolo) e os
  documentos. Nenhuma mudança na API nem em `packages/types`.
- Os nomes dos tokens ficam (`bg-bg`, `bg-panel`, `bg-surface`, `text-text`,
  `text-text-muted`, `border-border`…). Nunca usar `bg-background`, `bg-card`,
  `bg-muted`, `text-foreground`, `text-muted-foreground`.
- Só o tema claro. Nenhuma variante `dark:`.
- Verde (`success`) é a única cor de ação; vermelho (`danger`) só para alerta e
  exclusão; saída em texto neutro, entrada em verde.
- Ícones só de `lucide-react`; nenhum emoji nem símbolo de texto como ícone.
- Texto com contraste mínimo de 4,5:1; alvos de toque com 44px; campos com
  fonte de 16px.
- Sem `any`. Apenas Tailwind (sem CSS Modules nem styled-components).
- TDD: o teste falha antes da mudança de produção.
- Um commit por tarefa. Fluxo de cada commit: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`. Mensagem em português, no
  padrão `feat(web): ...`.
- Cada tarefa fecha marcando a própria caixa no Checkpoint de
  `docs/nova-ui/README.md` (com a data) e acrescentando uma linha ao Diário, no
  mesmo commit.
- Fora do escopo (não fazer): barra de cinco posições, rotas com URL,
  cabeçalho único, novo desenho de Extrato/Lançar/Início, ícones PNG do PWA,
  emoji escolhido pelo usuário no cofrinho (coluna `cofrinhos.emoji`: o valor
  gravado continua sendo mostrado como está).

## Review Focus

1. **Tela ou modal com texto ilegível no tema claro** (texto claro sobre fundo
   claro que sobrou do tema escuro). Teste de contraste dos tokens na Tarefa 1;
   capturas de todas as telas e modais na validação.
2. **App aberto sem rede**: a fonte continua Manrope. Conferido no build da
   Tarefa 2 (arquivo da fonte no precache do service worker).
3. **iPhone com barra de gestos**: o último item da tela e o rodapé dos painéis
   não ficam atrás da barra inferior nem da área segura. Tarefa 4.
4. **Valor grande no dashboard** (R$ 1.234.567,89 em 390px): não é cortado.
   Tarefa 7.
5. **Botão que era só um símbolo** ("✕", "◀", "▶", "←"): continua com nome
   acessível depois de virar ícone. Tarefa 8.

---

### Task 1: Tokens da paleta clara, tokens adicionais e cores de gráfico

**Files:**

- Modify: `apps/web/src/index.css`, `apps/web/tailwind.config.ts`
- Create: `apps/web/src/components/charts/chart-colors.ts`
- Test (create): `apps/web/src/tokens.test.ts`,
  `apps/web/src/components/charts/chart-colors.test.ts`
- Modify: `apps/web/src/components/charts/pie-chart.tsx`, `mini-chart.tsx`,
  `apps/web/src/pages/dashboard-page.tsx`, `historico-page.tsx`,
  `relatorios-page.tsx`, `metodos-pagamento-page.tsx`, e os arquivos com fundos
  translúcidos de token

**Interfaces:**

- Produces (Tailwind): cores `accent-soft`, `danger-soft`, `warning-soft`,
  `warning-fill`, `border-strong`, `border-soft`; `shadow-soft` passa a ser o
  anel de 1px na cor `border`.
- Produces: `CORES_CATEGORIAS: readonly string[]`, `COR_RECEITA`, `COR_DESPESA`,
  `COR_SALDO` em `chart-colors.ts`.

**Valores (formato `R G B` em `index.css`):**

| Token           | Valor         | Token            | Valor         |
| --------------- | ------------- | ---------------- | ------------- |
| `bg`            | `242 244 239` | `success`        | `15 107 62`   |
| `panel`         | `255 255 255` | `success-strong` | `11 83 48`    |
| `sidebar`       | `242 244 239` | `primary`        | `15 107 62`   |
| `surface`       | `236 239 233` | `danger`         | `179 38 30`   |
| `surface-hover` | `226 230 222` | `warning`        | `138 90 0`    |
| `card-alt`      | `248 249 246` | `info`           | `31 95 139`   |
| `border`        | `217 222 214` | `accent-soft`    | `221 235 226` |
| `text`          | `23 33 28`    | `danger-soft`    | `247 225 222` |
| `text-muted`    | `69 82 74`    | `warning-soft`   | `246 236 205` |
| `text-dim`      | `90 103 95`   | `warning-fill`   | `201 138 0`   |
| `border-strong` | `201 208 200` | `border-soft`    | `230 234 227` |

**Cores de gráfico:** `CORES_CATEGORIAS` =
`#0F6B3E`, `#1F5F8B`, `#5B3FA6`, `#B37A00`, `#B3261E`, `#0E7C86`, `#5A675F`.
`COR_RECEITA` `#0F6B3E`, `COR_DESPESA` `#45524A`, `COR_SALDO` `#1F5F8B`.

- [ ] **Step 1: Escrever os testes que falham.** `tokens.test.ts` importa
      `./index.css?raw`, lê cada `--color-<nome>: R G B` e verifica:
  - os 22 valores da tabela acima, um a um;
  - contraste mínimo de 4,5:1 (fórmula WCAG) para `text`, `text-muted` e
    `text-dim` sobre `bg`, `panel`, `surface` e `card-alt`;
  - 4,5:1 para branco sobre `success`, `success-strong`, `primary`, `danger` e
    `warning`;
  - 4,5:1 para `success` sobre `accent-soft`, `danger` sobre `danger-soft`,
    `warning` sobre `warning-soft` e `info` sobre `panel`.

  `chart-colors.test.ts`: toda cor de `CORES_CATEGORIAS`, `COR_RECEITA`,
  `COR_DESPESA` e `COR_SALDO` tem 3:1 ou mais sobre branco, e as sete cores de
  categoria são diferentes entre si.

- [ ] **Step 2: Rodar e ver falhar.**
      `pnpm --filter web exec vitest run src/tokens.test.ts src/components/charts/chart-colors.test.ts`
      — esperado: FAIL (valores do tema escuro; `chart-colors` não existe).

- [ ] **Step 3: Implementar.**
  - `index.css`: os valores da tabela em `:root`; o `body` continua com
    `bg-bg text-text`.
  - `tailwind.config.ts`: os seis tokens novos no mesmo formato
    `rgb(var(--color-x) / <alpha-value>)`; `boxShadow.soft` vira
    `0 0 0 1px rgb(var(--color-border))`.
  - Gráficos e páginas: toda cor em hexadecimal passa a vir de
    `chart-colors.ts`. Séries de receita, despesa e saldo usam as três
    constantes; o rótulo do `MiniChart` usa `text-dim`. Os fundos
    `bg-[#...]` de `metodos-pagamento-page.tsx` viram `bg-accent-soft`.
  - Fundos translúcidos: `bg-danger/5` e `bg-danger/10` → `bg-danger-soft`;
    `bg-warning/10` e `bg-warning/20` → `bg-warning-soft`; `bg-success/8`,
    `/10`, `/15` e `/20` → `bg-accent-soft`. Os de `info` ficam.
  - Anéis de foco `ring-primary/40`, `ring-success/40`, `ring-info/40`,
    `ring-info/30` e `ring-warning/40` → `ring-success`.
  - `text-white` continua onde está: só aparece sobre `success`,
    `success-strong`, `primary`, `warning` e `danger`.

- [ ] **Step 4: Rodar e ver passar** os dois testes e a suíte do Web inteira
      (`pnpm --filter web exec vitest run`); ajustar teste que fixava cor antiga.

- [ ] **Step 5: Commit** `feat(web): paleta clara, tokens adicionais e cores de gráfico`.

### Task 2: Manrope carregada pelo próprio app

**Files:**

- Modify: `apps/web/package.json` (dependência `@fontsource-variable/manrope`),
  `apps/web/src/main.tsx`, `apps/web/src/index.css`,
  `apps/web/tailwind.config.ts`, `apps/web/vite.config.ts`
- Test: `apps/web/src/tokens.test.ts`

- [ ] **Step 1: Escrever o teste que falha** em `tokens.test.ts`: o
      `font-family` de `:root` em `index.css` começa com `'Manrope Variable'`.

- [ ] **Step 2: Rodar e ver falhar** (hoje é `'Manrope'`, família que nenhum
      arquivo define).

- [ ] **Step 3: Implementar.**
  - `pnpm --filter web add @fontsource-variable/manrope`.
  - `main.tsx`: `import '@fontsource-variable/manrope';` antes de
    `./index.css`.
  - `index.css`: `font-family: 'Manrope Variable', 'Segoe UI', sans-serif;` e
    `font-variant-numeric: tabular-nums;` no `body`.
  - `tailwind.config.ts`: `fontFamily.sans` com a mesma lista.
  - `vite.config.ts`: `workbox.globPatterns` ganha
    `**/manrope-latin-wght-normal-*.woff2` (só o subconjunto latino entra no
    cache offline; os outros subconjuntos o navegador nem baixa em pt-BR).

- [ ] **Step 4: Verificar no build.** `pnpm --filter web build` e conferir:
      existe `apps/web/dist/assets/manrope-latin-wght-normal-*.woff2`, e
      `grep -c "manrope-latin-wght-normal" apps/web/dist/sw.js` é 1 ou mais.

- [ ] **Step 5: Commit** `feat(web): fonte Manrope no build e no cache offline`.

### Task 3: Fundo do `body`, `theme-color`, manifest e área segura

**Files:**

- Modify: `apps/web/index.html`, `apps/web/vite.config.ts`,
  `apps/web/tailwind.config.ts`, `apps/web/src/components/bottom-nav.tsx`,
  `apps/web/src/components/app-shell.tsx`, e os painéis de baixo para cima
  (`transacao-modal.tsx`, `voice-recording-sheet.tsx`, modais de cofrinho,
  `templates-gerenciar-modal.tsx`)
- Test (create): `apps/web/src/base-visual.test.ts`

- [ ] **Step 1: Escrever os testes que falham** em `base-visual.test.ts`,
      lendo `../index.html?raw`:
  - o `<body>` não tem `bg-slate-50`;
  - `theme-color` é `#F2F4EF`;
  - o `viewport` contém `viewport-fit=cover`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.**
  - `index.html`: as três mudanças do teste.
  - Manifest em `vite.config.ts`: `theme_color` e `background_color` em
    `#F2F4EF`.
  - `tailwind.config.ts`: `spacing.safe` = `env(safe-area-inset-bottom)`, o
    que faz a classe `pb-safe` (já usada em `bottom-nav.tsx`) passar a existir.
  - `app-shell.tsx`: o espaço reservado no `<main>` para a barra passa a ser
    `calc(68px + env(safe-area-inset-bottom))`, e o "+" sobe a mesma medida.
  - Painéis de baixo para cima: o rodapé com os botões ganha `pb-safe` no
    celular.

- [ ] **Step 4: Rodar e ver passar**, mais a suíte do Web.

- [ ] **Step 5: Commit** `feat(web): fundo, theme-color, manifest e área segura do iPhone`.

### Task 4: Altura do shell sem rolagem fantasma

**Files:**

- Modify: `apps/web/src/components/app-shell.tsx` e as páginas dentro do shell
  que usam `min-h-screen`
- Test: `apps/web/src/base-visual.test.ts`

- [ ] **Step 1: Escrever o teste que falha.** Com
      `import.meta.glob('./pages/*-page.tsx', { query: '?raw', import: 'default', eager: true })`,
      nenhuma página contém `min-h-screen`, exceto as que ficam fora do shell:
      `login-page`, `sign-up-page`, `onboarding-page` e `familia-selector-page`.

- [ ] **Step 2: Rodar e ver falhar** (17 arquivos usam `min-h-screen`).

- [ ] **Step 3: Implementar.** O contêiner raiz do `AppShell` usa `h-dvh` com
      `overflow-hidden`; o `<main>` continua sendo a única área que rola. Nas
      páginas dentro do shell, `min-h-screen` vira `min-h-full`. `auth-shell` e
      `auth-context` trocam `min-h-screen` por `min-h-dvh`.

- [ ] **Step 4: Rodar e ver passar**, mais a suíte do Web.

- [ ] **Step 5: Commit** `feat(web): shell na altura visível da tela, sem rolagem fantasma`.

### Task 5: Campos em 16px e alvos de toque com 44px

**Files:**

- Create: `apps/web/src/components/ui/campo-classes.ts`
- Modify: os 13 arquivos com `<input>`, `<select>` ou `<textarea>`
  (`grep -rlE "<(input|select|textarea)\b" apps/web/src --include='*.tsx'`),
  `ui/form-field.tsx`, `ui/custom-select.tsx`, `month-nav.tsx`,
  `extrato-page.tsx`, `categorias-page.tsx` e os botões de fechar dos modais
- Test: `apps/web/src/base-visual.test.ts`

**Interfaces:**

- Produces: `CAMPO_CLASSES: string` =
  `min-h-11 w-full rounded-[10px] border border-border-strong bg-surface px-3 text-base text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-success`.
- Produces: `ALVO_TOQUE_CLASSES: string` =
  `inline-flex min-h-11 min-w-11 items-center justify-center`.

- [ ] **Step 1: Escrever os testes que falham.** Com `import.meta.glob` sobre
      `./components/**/*.tsx` e `./pages/*.tsx` (sem `*.test.tsx`): nenhuma tag
      `<input`, `<select` ou `<textarea` tem `text-sm` ou `text-xs` no próprio
      `className`, com exceção de `type="radio"`, `type="checkbox"` e
      `type="range"`. E `CAMPO_CLASSES` contém `text-base` e `min-h-11`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.** Cada campo de texto, número, data e seleção
      passa a usar `CAMPO_CLASSES` (somando só o que for próprio do lugar,
      como largura ou alinhamento). Botões só de ícone (fechar de modal, setas
      do mês) e os controles pequenos apontados na auditoria (filtros do
      extrato, "editar" e "desativar" em categorias) ganham
      `ALVO_TOQUE_CLASSES`.

- [ ] **Step 4: Rodar e ver passar**, mais a suíte do Web.

- [ ] **Step 5: Commit** `feat(web): campos em 16px e alvos de toque com 44px`.

### Task 6: Escala de z-index

**Files:**

- Modify: `apps/web/tailwind.config.ts` e os 14 arquivos com `z-10`, `z-40` ou
  `z-50`
- Test: `apps/web/src/base-visual.test.ts`

**Interfaces:**

- Produces (Tailwind `zIndex`): `barra` = 40, `lancar` = 45, `painel` = 50,
  `aviso` = 60. Classes `z-barra`, `z-lancar`, `z-painel`, `z-aviso`.

- [ ] **Step 1: Escrever o teste que falha.** Com `import.meta.glob`, nenhum
      arquivo de `components/` ou `pages/` contém `z-<número>` nem `z-[`. E o
      "+" do `AppShell` (botão "Nova transação") tem a classe `z-lancar`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar.** Barra inferior → `z-barra`; "+" → `z-lancar`;
      modais, painéis, tour e a lista aberta do `CustomSelect` → `z-painel`. O
      `z-10` do `top-bar` vira `z-barra`. `z-aviso` fica só definido.

- [ ] **Step 4: Rodar e ver passar**, mais a suíte do Web.

- [ ] **Step 5: Commit** `feat(web): escala nomeada de z-index`.

### Task 7: Valores do dashboard sem corte em 390px

**Files:**

- Modify: `apps/web/src/pages/dashboard-page.tsx:165`
- Test: `apps/web/src/pages/dashboard-page.test.tsx`

- [ ] **Step 1: Escrever o teste que falha.** O cartão de Saldo vem antes dos
      de Receitas e Despesas e ocupa as duas colunas (`col-span-2`) de uma grade
      de duas colunas (`grid-cols-2`); nenhum dos três valores tem `truncate`.

- [ ] **Step 2: Rodar e ver falhar** (hoje é `grid-cols-3`, com Saldo por
      último).

- [ ] **Step 3: Implementar.** Saldo em cima, na largura toda; Receitas e
      Despesas abaixo, em duas colunas. Os valores usam `tabular-nums` e podem
      quebrar a linha entre "R$" e o número, nunca cortar. No desktop (`md:`) a
      grade pode voltar a três colunas.

- [ ] **Step 4: Rodar e ver passar**, mais a suíte do Web.

- [ ] **Step 5: Commit** `feat(web): valores do dashboard sem corte em telas estreitas`.

### Task 8: Emojis e símbolos trocados por ícones lucide

**Files:**

- Modify: os arquivos de `components/` e `pages/` com emoji ou símbolo
  (listar com
  `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{25A0}-\x{25FF}\x{2190}-\x{21FF}\x{2B00}-\x{2BFF}✕✓✔×]|\\\\u[dD]83" apps/web/src --include='*.tsx' --include='*.ts'`),
  `eslint.config.*` (regra nova), os testes do Web e os specs do E2E que
  procuram esses símbolos
- Test: os testes das páginas alteradas

- [ ] **Step 1: Escrever a regra de lint que falha.** No ESLint do projeto,
      para `apps/web/src/**/*.{ts,tsx}` (sem os testes), uma regra
      `no-restricted-syntax` proíbe emoji e os símbolos `✕ ✓ ✔ × ◀ ▶ ← → ↑ ↓`
      em texto JSX e em literais de string. Mensagem: "Use um ícone de
      lucide-react; a interface não usa emoji nem símbolo de texto como ícone".

- [ ] **Step 2: Rodar e ver falhar.** `pnpm lint` — esperado: erros nos
      arquivos listados.

- [ ] **Step 3: Implementar.** Cada ocorrência vira um ícone de
      `lucide-react` com `aria-hidden`; o botão que era só um símbolo ganha
      `aria-label` (fechar → "Fechar", setas do mês → "Mês anterior" e
      "Próximo mês", voltar → "Voltar"). Setas dentro de texto ("Ver todos →")
      viram o ícone ao lado do texto. O emoji que o usuário escolhe para o
      cofrinho continua sendo mostrado; só o emoji fixo do app (estado vazio,
      valor de exemplo do campo) sai.

- [ ] **Step 4: Ajustar testes e E2E** que procuravam o símbolo: passam a
      procurar pelo nome acessível.

- [ ] **Step 5: Rodar e ver passar.** `pnpm lint` e a suíte do Web.

- [ ] **Step 6: Commit** `feat(web): ícones lucide no lugar de emojis e símbolos de texto`.

### Task 9: Validação no navegador

Feita por quem valida, não por quem desenvolveu.

- [ ] **Step 1: Subir o ambiente isolado** conforme "Ambiente para validar no
      navegador" do `docs/nova-ui/README.md` e criar uma família de teste com
      cartão, compra parcelada, orçamento e cofrinho.

- [ ] **Step 2: Em 390×844 com o `agent-browser`,** capturar cada tela (login,
      cadastro, onboarding, dashboard, lançamentos, extrato, orçamento,
      categorias, métodos de pagamento, cofrinhos, detalhe do cofrinho, fatura,
      relatórios, histórico, perfil, configurações, família, ajuda) e cada
      modal (transação, os quatro de cofrinho, modelos, tour). Em cada uma,
      medir por script:
  - `document.documentElement.scrollHeight` não passa de `window.innerHeight`
    (a rolagem é do `<main>`);
  - todo `button`, `a`, `input`, `select` e `textarea` visível tem pelo menos
    44px de altura (largura também, se for só ícone);
  - todo campo tem `font-size` computado de 16px ou mais;
  - `getComputedStyle(document.body).fontFamily` começa com `Manrope Variable`
    e `document.fonts.check('16px "Manrope Variable"')` é verdadeiro;
  - nenhum texto visível com contraste abaixo de 4,5:1 contra o próprio fundo
    (amostrar títulos, rótulos, valores e botões).

- [ ] **Step 3: Conferir o dashboard em 1280px** para garantir que o desktop
      não quebrou.

- [ ] **Step 4: Encerrar o ambiente** (processos e
      `docker compose -f apps/e2e/docker-compose.e2e.yml down -v`).
