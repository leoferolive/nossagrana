# Nova UI — Entrega 2, PR 2 (Barra de cinco, Mais, Planejar, cabeçalhos e tour): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar a navegação visível do celular: barra de cinco posições com o
"+" dentro, tela Mais no lugar de Configurações, tela Planejar como entrada,
um cabeçalho de aba e um de detalhe para todas as telas, e um só tour.

**Architecture:** os endereços já existem (PR #188). Este PR troca os
componentes de navegação (`BottomNav`, `AppShell`), cria três peças novas
(`CabecalhoAba`, `CabecalhoDetalhe`, e as telas Mais e Planejar) e faz as
páginas falarem com o roteador direto: as propriedades `onBack`, `onNavigate` e
`onGoTo...` das páginas saem, e o "voltar" passa a morar no `CabecalhoDetalhe`.

**Tech Stack:** React 19, `react-router` 7 (modo declarativo), Tailwind 3,
`lucide-react`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-nova-ui-entrega-2-design.md`
(seções "Mapa de endereços", "Telas e componentes novos", "O que seria um
fracasso" e "Como sai", item 2). Medidas e cores: "Sistema visual" e
"Navegação" em `docs/nova-ui/README.md`.

## Global Constraints

- Só `apps/web` e os documentos. Nenhuma mudança na API, em `packages/types` nem
  nos specs do E2E (são do PR 3).
- Os endereços de `apps/web/src/routes/caminhos.ts` não mudam.
- O conteúdo das telas não muda: só o cabeçalho de cada uma e a navegação.
  Extrato, Lançar e Início continuam com o miolo de hoje (Entregas 3 e 4).
- O `familiaId` vem sempre da sessão (`useAuth`), nunca do endereço.
- Medidas do README: barra de 84px mais a área segura, cinco colunas, aba com
  ícone de 24 e rótulo de 11px (ativa 700 `success`, inativa 600 `text-dim`);
  "+" central de 58px, fundo `success`, ícone branco de 28px, 28px acima da
  barra, anel de 6px na cor `bg`; título de aba 26/800; cabeçalho de detalhe
  com voltar de 44×44 e título 20/800.
- Tokens existentes; verde como única cor de ação; ícones só de `lucide-react`;
  sem emoji; alvos de 44px; campos em 16px; z-index pelos nomes (`z-barra`,
  `z-lancar`, `z-painel`).
- Desktop (`md:` para cima): o menu lateral continua, reorganizado nos grupos da
  tela Mais e apontando para os mesmos endereços; a barra inferior não aparece.
- Sem `any`. Sem prop drilling novo. Arquivo com até 500 linhas, função curta.
- TDD: o teste falha antes da mudança de produção.
- Um commit por tarefa. Fluxo de cada commit: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`.
- Cada tarefa marca a própria caixa no Checkpoint de `docs/nova-ui/README.md`
  (seção "Entrega 2") e acrescenta uma linha ao Diário.

## Review Focus

1. **Tela sem entrada no celular:** todas as telas do mapa são alcançáveis em
   até dois toques a partir da barra. Teste na Tarefa 3.
2. **Aba marcada em tela de segundo nível:** em `/mais/categorias` a aba Mais
   está marcada; em `/planejar/cofrinhos/<id>`, Planejar. Teste na Tarefa 1.
3. **"+" com painel aberto e com teclado:** o "+" não fica por cima do painel
   de lançar. Teste na Tarefa 1.
4. **Voltar de detalhe aberto por link direto:** vai para a tela de origem do
   mapa, sem sair do app. Teste na Tarefa 2.
5. **Quem já viu os tours antigos:** vê o tour novo uma vez; quem já viu o novo
   não vê de novo. Teste na Tarefa 5.

---

### Task 1: Barra de cinco posições com o "+" dentro

**Files:**

- Modify: `apps/web/src/components/bottom-nav.tsx`,
  `apps/web/src/components/app-shell.tsx`, `apps/web/src/routes/caminhos.ts`
- Test: `apps/web/src/components/bottom-nav.test.tsx` (criar se não existir),
  `apps/web/src/components/app-shell.test.tsx`, `apps/web/src/routes/caminhos.test.ts`

**Interfaces:**

- Produces: `abaDoCaminho(pathname: string): 'inicio' | 'extrato' | 'planejar' | 'mais'`
  em `caminhos.ts` — `/` é `inicio`; `/extrato` é `extrato`; tudo sob
  `/planejar` é `planejar`; tudo sob `/mais` é `mais`; desconhecido é `inicio`.
- `BottomNav` passa a receber `{ abaAtiva, onLancar, onSegurarLancar? }` e a
  navegar por `NavLink`/`useNavigate` para `CAMINHOS.inicio`, `.extrato`,
  `.planejar` e `.mais`.

- [ ] **Step 1: Escrever os testes que falham:**
  - a barra tem, nesta ordem, Início, Extrato, o botão "Lançar" e Planejar,
    Mais; os quatro são links com os endereços certos;
  - `abaDoCaminho` para cada linha do mapa da spec;
  - em `/mais/categorias` a aba Mais tem `aria-current="page"`; em
    `/planejar/cofrinhos/c1`, Planejar;
  - o botão "Lançar" chama `onLancar`; segurar chama `onSegurarLancar`;
  - o `AppShell` não renderiza mais o botão flutuante; o botão "Lançar" da
    barra tem a classe `z-lancar` e a barra, `z-barra`;
  - o espaço reservado no fim do `<main>` passa a ser
    `calc(84px + env(safe-area-inset-bottom))` mais a folga do "+" (28px).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** com as medidas das Global Constraints. A lógica
      de toque longo para voz sai do `AppShell` e vai com o botão da barra.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): barra inferior de cinco posições com o "+" dentro`.

### Task 2: Cabeçalhos únicos e páginas falando com o roteador

**Files:**

- Create: `apps/web/src/components/cabecalho-aba.tsx`,
  `apps/web/src/components/cabecalho-detalhe.tsx` e os testes de cada um
- Modify: as páginas de `apps/web/src/pages/` que hoje têm cabeçalho próprio ou
  recebem `onBack`/`onNavigate`/`onGoTo...`, `apps/web/src/routes/telas-logadas.tsx`,
  `apps/web/src/components/month-nav.tsx` (vira a pílula de mês)
- Test: os testes das páginas alteradas; `apps/web/src/test/render-pagina.tsx` (criar)

**Interfaces:**

- Produces: `<CabecalhoAba titulo mes? onMesChange? acoes? />` — título 26/800 à
  esquerda; à direita, a pílula de mês quando `mes` é passado.
- Produces: `<CabecalhoDetalhe titulo origem acao? />` — botão "Voltar" de
  44×44 que chama `voltarPara(origem)` de `use-navegacao.ts`; título 20/800.
- Produces: `renderPagina(elemento, caminho?)` em `src/test/render-pagina.tsx` —
  monta uma página dentro de um `MemoryRouter`.
- Pílula de mês (README): dois botões de 44×44 com seta e o mês em 14/700; fundo
  `panel`, anel `border`, raio 999.

**Qual cabeçalho em cada tela:**

| Cabeçalho  | Telas                                                                           | Origem do voltar     |
| ---------- | ------------------------------------------------------------------------------- | -------------------- |
| De aba     | Início, Extrato, Planejar, Mais                                                 | —                    |
| De detalhe | Lançamentos do mês, Orçamento, Cofrinhos                                        | `CAMINHOS.planejar`  |
| De detalhe | Detalhe do cofrinho                                                             | `CAMINHOS.cofrinhos` |
| De detalhe | Fatura                                                                          | `CAMINHOS.planejar`  |
| De detalhe | Relatórios, Histórico, Família, Categorias, Métodos de pagamento, Perfil, Ajuda | `CAMINHOS.mais`      |

- [ ] **Step 1: Escrever os testes que falham:** os dois componentes (título,
      nome acessível do voltar, pílula de mês chamando `onMesChange`, voltar
      por link direto indo para a origem); e, em cada página da tabela, o
      título no nível certo (`heading` nível 1) e, nas de detalhe, o botão
      "Voltar".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Cada página troca o cabeçalho próprio pelo
      componente e perde as propriedades de navegação; onde navegava por
      propriedade passa a usar `useNavegacao` ou `Link` com `CAMINHOS`. A fatura
      aberta a partir de Métodos de pagamento continua funcionando.
      `telas-logadas.tsx` deixa de montar essas propriedades.
- [ ] **Step 4: Migrar os testes das páginas** para `renderPagina`, mantendo os
      cenários.
- [ ] **Step 5: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 6: Commit** `feat(web): cabeçalho único de aba e de detalhe`.

### Task 3: Tela Mais

**Files:**

- Create: `apps/web/src/pages/mais-page.tsx`, `mais-page.test.tsx`
- Delete: `apps/web/src/pages/configuracoes-page.tsx` e o teste dela
- Modify: `apps/web/src/routes/telas-logadas.tsx`, `apps/web/src/components/sidebar.tsx`

**Grupos e destinos:**

| Grupo     | Item                 | Destino                     |
| --------- | -------------------- | --------------------------- |
| Análises  | Relatórios           | `CAMINHOS.relatorios`       |
| Análises  | Histórico            | `CAMINHOS.historico`        |
| Família   | Família              | `CAMINHOS.familia`          |
| Família   | Alternar família     | `CAMINHOS.familias`         |
| Cadastros | Categorias           | `CAMINHOS.categorias`       |
| Cadastros | Métodos de pagamento | `CAMINHOS.metodosPagamento` |
| Conta     | Perfil               | `CAMINHOS.perfil`           |
| Conta     | Ajuda                | `CAMINHOS.ajuda`            |
| Conta     | Sair                 | encerra a sessão            |

- [ ] **Step 1: Escrever os testes que falham:** os quatro grupos com esses
      itens, cada item como link para o destino; "Sair" encerra a sessão; cada
      linha tem pelo menos 44px de altura (classe `min-h-11`); toda tela do
      mapa da spec é alcançável a partir da barra em até dois toques (teste de
      `App` percorrendo Mais e Planejar); o menu lateral do desktop tem os
      mesmos grupos.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Cartão por grupo (fundo `panel`, anel `border`,
      raio 18), linha com ícone, nome e seta. "Sair" em `danger`.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): tela Mais no lugar de Configurações`.

### Task 4: Tela Planejar (entrada)

**Files:**

- Create: `apps/web/src/pages/planejar-page.tsx`, `planejar-page.test.tsx`
- Modify: `apps/web/src/routes/app-rotas.tsx` / `telas-logadas.tsx` (o
  redirecionamento de `/planejar` para `/planejar/contas` sai)

**Linhas do cartão:**

| Linha                 | Resumo à direita                                          | Destino                    |
| --------------------- | --------------------------------------------------------- | -------------------------- |
| Contas do mês         | "N de M lançadas" (modelos do mês, das stores existentes) | `CAMINHOS.contas`          |
| Limites por categoria | "N de M estourados" (orçamento do mês)                    | `CAMINHOS.limites`         |
| Fatura `<cartão>`     | "vence DD/MM" (uma linha por cartão de crédito ativo)     | `caminhoDaFatura(id, mês)` |
| Cofrinhos             | "N ativos"                                                | `CAMINHOS.cofrinhos`       |

- [ ] **Step 1: Escrever os testes que falham:** título "Planejar" com a pílula
      de mês; as quatro linhas com os resumos calculados a partir de dados de
      teste; duas linhas de fatura quando há dois cartões e nenhuma quando não
      há cartão; estados de carregando e de erro; `renderApp('/planejar')`
      mostra a tela Planejar.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar,** reutilizando as stores e os serviços que as
      telas de destino já usam; sem chamada nova à API. Quando um resumo não
      puder ser calculado com o que já existe, a linha aparece sem resumo.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): tela Planejar como entrada do planejamento`.

### Task 5: Um único tour de boas-vindas

**Files:**

- Modify: `apps/web/src/components/first-time-tour.tsx`,
  `apps/web/src/pages/dashboard-page.tsx`, `apps/web/src/pages/ajuda-page.tsx` e
  as sete outras páginas que hoje montam um tour
- Test: `first-time-tour.test.tsx`, `dashboard-page.test.tsx`, `ajuda-page.test.tsx`

**Passos do tour (chave `boas-vindas`):**

1. **Início** — "Aqui você vê o saldo do mês, quanto entrou e quanto saiu."
2. **Lançar** — "Toque no + para lançar uma despesa ou receita. Segure para
   lançar por voz."
3. **Planejar** — "Contas do mês, limites por categoria, faturas e cofrinhos
   ficam aqui."
4. **Mais** — "Relatórios, família, cadastros e a sua conta ficam aqui."

- [ ] **Step 1: Escrever os testes que falham:** o tour aparece no primeiro
      acesso ao Início com os quatro passos; não aparece de novo depois de
      concluído ou pulado; aparece uma vez para quem tem as chaves dos tours
      antigos gravadas; nenhuma outra página monta tour; "Rever tutorial", em
      Ajuda, leva ao Início com o tour aberto.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** e remover os tours das outras páginas.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): um único tour de boas-vindas`.

### Task 6: Validação no navegador

Feita por quem valida. Em 390×844, no ambiente isolado do README:

- [ ] Barra: cinco posições, medidas do README, "+" central; aba certa marcada
      em cada endereço do mapa; "+" abre o painel e fica atrás dele.
- [ ] Toda tela alcançável em até dois toques a partir da barra.
- [ ] Cabeçalhos: um só estilo de aba e um só de detalhe; "Voltar" funciona por
      navegação e por link direto.
- [ ] Mais e Planejar com os grupos, linhas e resumos certos.
- [ ] Tour único no primeiro acesso; "Rever tutorial" reabre.
- [ ] Medidas da Entrega 1 em todas as telas (rolagem só no `<main>`, alvos de
      44px, campos em 16px, contraste, nada fora da tela) e fim da rolagem sem
      conteúdo atrás da barra.
- [ ] Dashboard e uma tela de detalhe em 1280×800: menu lateral com os grupos
      novos e sem barra inferior.
- [ ] Cenários de histórico do PR #188 continuam passando.
