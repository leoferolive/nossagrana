# Nova UI — Entrega 2, PR 1 (Rotas com URL): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar endereço a toda tela do `apps/web`, para o voltar do Android,
recarregar e link direto funcionarem, sem mudar a aparência nem a barra de hoje.

**Architecture:** entra o `react-router` 7 no modo declarativo. O `App.tsx`,
que hoje escolhe a tela por um estado `screen`, passa a escolher pelo endereço.
As páginas e o `AppShell` continuam recebendo as mesmas propriedades de
navegação (`onBack`, `onNavigate`, `currentScreen`); quem muda é a camada de
rotas, que traduz essas propriedades em navegação por endereço. As páginas só
passam a falar direto com o roteador no PR 2, junto com os cabeçalhos únicos.

**Tech Stack:** React 19, Vite 6, `react-router` 7 (modo declarativo:
`BrowserRouter`, `Routes`, `Route`, `Navigate`, `useNavigate`, `useLocation`,
`useParams`, `useSearchParams`; nos testes, `MemoryRouter`), Vitest + Testing
Library, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-11-16-nova-ui-entrega-2-design.md`
(seções "Mapa de endereços", "O que seria um fracasso" e "Como sai", item 1).

## Global Constraints

- Só `apps/web` e os documentos. Nenhuma mudança na API, em `packages/types` nem
  nos specs do E2E (são do PR 3).
- Nenhuma mudança visual: a barra de quatro abas, o "+" flutuante, a tela
  Configurações e os cabeçalhos de hoje continuam como estão.
- O `familiaId` vem sempre da sessão (`useAuth`), nunca do endereço.
- Os endereços são os do mapa da spec, sem variação. Eles não mudam nos PRs
  seguintes.
- Sem `any`. Sem prop drilling novo: estado que mais de um componente precisa
  vai no endereço ou em store Zustand.
- Arquivo com até 500 linhas e função curta: o `App.tsx` (454 linhas) deve
  sair menor do que entrou, com as rotas em arquivos próprios.
- TDD: o teste falha antes da mudança de produção.
- Um commit por tarefa. Fluxo de cada commit: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`.
- Cada tarefa fecha com uma linha no Diário de `docs/nova-ui/README.md`; a
  caixa "Rotas com URL" do Checkpoint é marcada na última tarefa.

## Mapa de endereços e telas de hoje

| Tela de hoje (`Screen`) | Endereço                                 |
| ----------------------- | ---------------------------------------- |
| `login`                 | `/entrar`                                |
| `sign-up`               | `/cadastro`                              |
| `onboarding`            | `/boas-vindas`                           |
| `familia-selector`      | `/familias`                              |
| `dashboard`             | `/`                                      |
| `extrato`               | `/extrato`                               |
| `lancamentos`           | `/planejar/contas`                       |
| `orcamento`             | `/planejar/limites`                      |
| `cofrinhos`             | `/planejar/cofrinhos`                    |
| `cofrinho-detalhe`      | `/planejar/cofrinhos/:cofrinhoId`        |
| `fatura`                | `/planejar/fatura/:metodoId?mes=AAAA-MM` |
| `configuracoes`         | `/mais`                                  |
| `relatorios`            | `/mais/relatorios`                       |
| `historico`             | `/mais/historico`                        |
| `family-settings`       | `/mais/familia`                          |
| `categorias`            | `/mais/categorias`                       |
| `metodos-pagamento`     | `/mais/metodos-pagamento`                |
| `perfil`                | `/mais/perfil`                           |
| `ajuda`                 | `/mais/ajuda`                            |

`/planejar` redireciona para `/planejar/contas` até o PR 2 criar a tela
Planejar. Endereço desconhecido redireciona para `/`.

## Review Focus

1. **Link direto sem login:** abrir `/mais/categorias` deslogado leva a
   `/entrar` e, depois do login, a `/mais/categorias`, não ao Início. Teste na
   Tarefa 3.
2. **Voltar com o painel de lançar aberto e valor digitado:** fecha só o
   painel; a tela de baixo continua a mesma. Teste na Tarefa 5.
3. **Sair e apertar voltar:** não mostra tela protegida. Teste na Tarefa 3.
4. **Id de cofrinho inexistente ou de outra família no endereço:** a tela
   mostra o próprio estado de erro, sem quebrar. Teste na Tarefa 4.
5. **Trocar de família estando num endereço com id** (detalhe de cofrinho,
   fatura): vai para o Início com a família nova. Teste na Tarefa 4.

---

### Task 1: Dependência e mapa de caminhos

**Files:**

- Modify: `apps/web/package.json`, `pnpm-lock.yaml`
- Create: `apps/web/src/routes/caminhos.ts`
- Test (create): `apps/web/src/routes/caminhos.test.ts`

**Interfaces:**

- Produces: `CAMINHOS` (objeto constante com um endereço por tela sem
  parâmetro: `entrar`, `cadastro`, `boasVindas`, `familias`, `inicio`,
  `extrato`, `planejar`, `contas`, `limites`, `cofrinhos`, `mais`, `relatorios`,
  `historico`, `familia`, `categorias`, `metodosPagamento`, `perfil`, `ajuda`).
- Produces: `caminhoDoCofrinho(cofrinhoId: string): string` e
  `caminhoDaFatura(metodoId: string, mes: string): string`.
- Produces: `caminhoDaTela(tela: string): string` — traduz o identificador de
  tela de hoje (tabela acima) para o endereço; identificador desconhecido
  devolve `CAMINHOS.inicio`. `cofrinho-detalhe` e `fatura` não entram aqui
  (precisam de parâmetro).
- Produces: `telaDoCaminho(pathname: string): string` — o caminho inverso, para
  o `AppShell` saber a aba ativa; qualquer endereço sob `/planejar/cofrinhos/`
  devolve `cofrinho-detalhe` e sob `/planejar/fatura/` devolve `fatura`;
  endereço desconhecido devolve `dashboard`.

- [ ] **Step 1: Escrever os testes que falham:** cada linha da tabela acima nas
      duas direções; `caminhoDoCofrinho('abc')` é `/planejar/cofrinhos/abc`;
      `caminhoDaFatura('m1', '2026-11')` é `/planejar/fatura/m1?mes=2026-11`;
      identificador e endereço desconhecidos caem nos padrões descritos.
- [ ] **Step 2: Rodar e ver falhar.**
      `pnpm --filter web exec vitest run src/routes/caminhos.test.ts`
- [ ] **Step 3: Implementar** e instalar a dependência:
      `pnpm --filter web add react-router`.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(web): mapa de endereços das telas`.

### Task 2: Telas escolhidas pelo endereço

**Files:**

- Modify: `apps/web/src/main.tsx` (`BrowserRouter` em volta do `App`),
  `apps/web/src/App.tsx`
- Create: `apps/web/src/routes/app-rotas.tsx` (a árvore de `Routes`),
  `apps/web/src/test/render-app.tsx`
- Test: os quatro `apps/web/src/App.*.test.tsx`
- Test (create): `apps/web/src/App.rotas.test.tsx`

**Interfaces:**

- Consumes: `CAMINHOS`, `caminhoDaTela`, `telaDoCaminho` (Tarefa 1).
- Produces: `renderApp(caminhoInicial?: string)` em `src/test/render-app.tsx` —
  monta `<App />` dentro de um `MemoryRouter` com o caminho dado (padrão `/`) e
  devolve o resultado do `render`.

- [ ] **Step 1: Escrever os testes que falham** em `App.rotas.test.tsx`, com
      sessão ativa e família (mocks de `@/test/app-mocks`):
  - `renderApp('/extrato')` mostra o Extrato (recarregar mantém a tela);
  - `renderApp('/mais/categorias')` mostra Categorias (link direto);
  - um endereço para cada linha sem parâmetro da tabela mostra a tela certa;
  - clicar em "Ver extrato" a partir de `/` muda a tela para o Extrato;
  - `renderApp('/nao-existe')` mostra o Início;
  - `renderApp('/planejar')` mostra Lançamentos.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** O estado `screen` e o `renderContent` saem do
      `App.tsx`; a tela vem do endereço. As propriedades de navegação das
      páginas continuam as mesmas, agora ligadas a `navigate(...)`: `onBack`
      vai para o mesmo destino de hoje e `onNavigate(tela)` usa
      `caminhoDaTela`. O `AppShell` recebe `currentScreen` de `telaDoCaminho`.
      O que é estado de tela no `App` (cofrinho selecionado, método e mês da
      fatura) continua em estado nesta tarefa; passa para o endereço na
      Tarefa 4.
- [ ] **Step 4: Migrar os quatro arquivos de teste do `App`** para
      `renderApp`, mantendo os mesmos cenários e as mesmas afirmações.
- [ ] **Step 5: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 6: Commit** `feat(web): telas escolhidas pelo endereço`.

### Task 3: Guardas e retorno ao endereço pedido

**Files:**

- Create: `apps/web/src/routes/guardas.tsx`
- Modify: `apps/web/src/routes/app-rotas.tsx`, `apps/web/src/App.tsx`
- Test: `apps/web/src/App.rotas.test.tsx`

**Regras:**

| Situação                                                  | Resultado                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Sem login, endereço protegido                             | vai para `/entrar`, guardando o endereço pedido                              |
| Login feito, havia endereço pedido e a família está ativa | vai para o endereço pedido                                                   |
| Login feito, sem endereço pedido                          | regra de hoje: 0 famílias → `/boas-vindas`; 1 → `/`; 2 ou mais → `/familias` |
| Com login e sem família ativa, endereço protegido         | vai para `/boas-vindas`                                                      |
| Com login, em `/entrar` ou `/cadastro`                    | vai para `/`                                                                 |
| Sair                                                      | vai para `/entrar` substituindo a entrada do histórico                       |

O endereço pedido só é aceito se começar com `/` e não com `//` (nunca
redirecionar para fora do app).

- [ ] **Step 1: Escrever os testes que falham:** uma afirmação por linha da
      tabela; link direto sem login seguido de login chega em
      `/mais/categorias`; depois de sair, a tela é o login e voltar no
      histórico não mostra tela protegida; endereço pedido `//evil.example`
      é descartado e o login leva ao Início.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** as guardas como componentes de rota.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): guardas de rota e retorno ao endereço pedido`.

### Task 4: Cofrinho e fatura no endereço

**Files:**

- Modify: `apps/web/src/routes/app-rotas.tsx`, `apps/web/src/App.tsx`,
  `apps/web/src/pages/fatura-page.tsx` (só se preciso para o nome do cartão)
- Test: `apps/web/src/App.rotas.test.tsx`

- [ ] **Step 1: Escrever os testes que falham:**
  - `renderApp('/planejar/cofrinhos/c1')` mostra o detalhe do cofrinho `c1`;
  - abrir um cofrinho pela lista muda o endereço para
    `/planejar/cofrinhos/<id>`;
  - `renderApp('/planejar/fatura/m1?mes=2026-11')` mostra a fatura do método
    `m1` em novembro de 2026, com o nome do cartão;
  - sem `mes` no endereço, a fatura usa o mês corrente;
  - cofrinho inexistente mostra o estado de erro da própria tela;
  - trocar de família estando em `/planejar/cofrinhos/c1` leva ao Início.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Os estados `cofrinhoIdSelecionado`,
      `faturaMetodoId`, `faturaMetodoNome` e `faturaMes` saem do `App`; os ids
      vêm de `useParams` e o mês de `useSearchParams`. O nome do cartão passa a
      vir da store de métodos de pagamento (carregando a lista se estiver
      vazia), e não mais de estado. `mes` fora do formato `AAAA-MM` é tratado
      como ausente.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): cofrinho e fatura identificados pelo endereço`.

### Task 5: Painel de lançar no endereço

**Files:**

- Create: `apps/web/src/hooks/use-painel-lancar.ts`
- Test (create): `apps/web/src/hooks/use-painel-lancar.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.rotas.test.tsx`

**Interfaces:**

- Produces: `usePainelLancar()` devolve
  `{ aberto: boolean; transacaoId: string | null; abrirNova(): void; abrirEdicao(id: string): void; fechar(): void }`.
  `abrirNova` e `abrirEdicao` acrescentam `?lancar=nova` ou `?lancar=<id>` ao
  endereço atual como entrada nova do histórico; `fechar` volta uma entrada
  quando o painel foi aberto por essas funções e, se o endereço já chegou com o
  parâmetro (link direto ou recarga), só remove o parâmetro, substituindo a
  entrada.

- [ ] **Step 1: Escrever os testes que falham:**
  - abrir o painel acrescenta `?lancar=nova` sem trocar a tela de baixo;
  - voltar no histórico com o painel aberto fecha o painel e mantém o endereço
    da tela (com valor digitado no formulário);
  - fechar pelo botão deixa o histórico como estava antes de abrir (um voltar
    depois disso sai da tela, e não reabre o painel);
  - editar uma transação pelo extrato abre com `?lancar=<id>`;
  - recarregar em `?lancar=<id>` de uma transação que não está em memória
    remove o parâmetro e mostra a tela, sem painel;
  - o fluxo de voz termina abrindo o painel pelo mesmo caminho.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** O estado `novaTransacaoOpen` sai do `App`; a
      transação em edição continua em memória, indexada pelo id do endereço.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Commit** `feat(web): painel de lançar no histórico de navegação`.

### Task 6: PWA e fechamento

**Files:**

- Modify: `apps/web/vite.config.ts`, `docs/nova-ui/README.md`
- Test: `apps/web/src/base-visual.test.ts`

- [ ] **Step 1: Escrever o teste que falha:** lendo `../vite.config.ts?raw`, o
      `workbox` tem `navigateFallbackDenylist` cobrindo `/api/` e `/health`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** e marcar a caixa "Rotas com URL" no Checkpoint.
- [ ] **Step 4: Verificar no build.** `pnpm --filter web build` e conferir que
      `apps/web/dist/sw.js` registra o retorno de navegação para `index.html`
      com a lista de exclusão.
- [ ] **Step 5: Commit** `feat(web): service worker não responde chamadas de API como navegação`.

### Task 7: Validação no navegador

Feita por quem valida, não por quem desenvolveu. Em 390×844, no ambiente
isolado do `docs/nova-ui/README.md`:

- [ ] Recarregar em cada endereço do mapa mantém a tela.
- [ ] O voltar do navegador percorre as telas visitadas na ordem inversa, em
      cada nível (aba → Configurações → Categorias, por exemplo).
- [ ] Link direto sem login: cai no login e, depois de entrar, na tela pedida.
- [ ] Painel de lançar: voltar fecha o painel; a tela de baixo continua.
- [ ] Sair e voltar: não mostra tela protegida.
- [ ] Aparência igual à de antes do PR (comparar com as capturas `r2-*` do
      PR #186), e as medidas da Entrega 1 continuam valendo (rolagem só no
      `<main>`, alvos de 44px, campos em 16px).
- [ ] Build de produção servido como arquivo estático: abrir um endereço
      interno direto funciona (o servidor devolve o `index.html`).
