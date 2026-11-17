# Nova UI — Entrega 3, PR 3 (Lançar): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** redesenhar o painel de lançar: valor primeiro; categoria, data e
forma de pagamento em chips; "Mais opções" para descrição, parcelas, repetição
e excluir; salvar fixo no rodapé; microfone ao lado do valor; aviso "lançado"
com "Desfazer"; confirmação de exclusão num painel do app.

**Architecture:** o `TransacaoModal` (425 linhas) é dividido em partes pequenas
em `apps/web/src/components/lancar/`. O contrato de dados não muda: o painel
continua produzindo `TransacaoCreateRequest` e `TransacaoUpdateRequest`. Abrir
e fechar continuam pelo `usePainelLancar` (uma entrada do histórico por
abertura) e a gravação pelo `useLancamento`, que já sinaliza a mudança para o
Extrato (PR anterior). O aviso com desfazer mora numa store Zustand própria.

**Tech Stack:** React 19, Zustand, Tailwind 3, `lucide-react`, Vitest +
Testing Library, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-11-16-nova-ui-entrega-3-design.md`
(seções "Lançar", "Objetivos" 4 a 6, "O que seria um fracasso", "Riscos").
Medidas: "Sistema visual" de `docs/nova-ui/README.md` (Chip, Botão primário,
Valor do lançamento, Painel de baixo para cima, Aviso). Roteiro: seção "Lançar"
de `docs/nova-ui/telas.md` (o item "Lazer de quem" fica para a Entrega 4).

## Global Constraints

- Só `apps/web`, `apps/e2e` e os documentos. Nenhuma mudança na API nem em
  `packages/types`.
- Endereços, `usePainelLancar` e o comportamento de histórico do PR #188 não
  mudam: voltar fecha o painel; fechar, salvar ou excluir andam no histórico
  uma vez só; os dados de voz são limpos quando o painel fecha.
- Datas: `getTodayLocalISO` para "Hoje"; "Ontem" calculado com ano, mês e dia
  numéricos; nunca `toISOString` para data do lançamento.
- Medidas do README: chip com 44px, 14/600, anel `border-strong`, selecionado
  com fundo `success` e texto branco 700; campo de valor 56/800 sem borda, altura
  64, prefixo "R$" 22/700 `text-dim`; microfone circular de 52px; botão primário
  com 56px, raio 16, fundo `success`, texto branco 16/800; painel com raio 28 no
  topo, alça de 40×4; aviso com 48px, raio 14.
- O painel ocupa no máximo a altura visível da tela (`dvh`) e o rodapé com o
  botão fica dentro dele, visível com o teclado aberto.
- Verde é a única cor de ação; "Excluir" em `danger`. Ícones só de
  `lucide-react`; sem emoji; alvos de 44px; campos em 16px.
- Sem `any`. Arquivo com até 500 linhas, função curta, sem prop drilling novo.
- TDD: o teste falha antes da mudança de produção.
- Um commit por tarefa. Fluxo: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`.
- Cada tarefa acrescenta uma linha ao Diário de `docs/nova-ui/README.md` e marca
  as caixas da Entrega 3 que conclui.

## O que a exclusão faz hoje (decide o "Desfazer")

Excluir um lançamento apaga só aquela linha; as parcelas ou repetições filhas
ficam com `transacao_pai_id` nulo (a chave é `on delete set null`). Por isso o
"Desfazer" aparece **só para lançamento simples** (sem parcelas e sem
repetição). Lançamento parcelado ou recorrente mostra o aviso sem "Desfazer".

## Review Focus

1. **"Desfazer" depois de 5 segundos e depois de navegar:** apaga exatamente o
   lançamento recém-criado, uma vez; não aparece para parcelado ou recorrente.
2. **Teclado virtual aberto no valor:** o botão de salvar continua visível.
3. **Edição de um lançamento com categoria fora das seis mais usadas:** a
   categoria dele aparece selecionada.
4. **Voz preenchendo o painel e depois voltar:** o rascunho some (regra do
   PR #188) e o painel novo abre vazio.
5. **Salvar duas vezes seguidas rápido:** grava um lançamento só.

---

### Task 1: Categorias mais usadas

**Files:**

- Create: `apps/web/src/utils/categorias-mais-usadas.ts` e o teste
- Create: `apps/web/src/hooks/use-categorias-mais-usadas.ts` e o teste

**Interfaces:**

- Produces: `categoriasMaisUsadas(entrada: { transacoes: Transacao[]; categorias: Categoria[]; tipo: 'receita' | 'despesa'; hoje: string; limite?: number }): Categoria[]`
  — só categorias ativas do tipo; contagem de lançamentos com `data` nos
  últimos 60 dias (inclusive hoje); ordem por contagem, desempate por nome;
  completa com as primeiras categorias do tipo na ordem da lista quando houver
  menos de `limite` (padrão 6).
- Produces: `useCategoriasMaisUsadas(familiaId: string, tipo)` — busca os
  lançamentos dos três últimos meses de referência (mês atual e os dois
  anteriores) com o serviço de transações que já existe, uma vez por família
  enquanto o app está aberto, e devolve a lista calculada; enquanto carrega ou
  se falhar, devolve as primeiras do tipo.

- [ ] **Step 1: Escrever os testes que falham:** contagem e ordem; janela de 60
      dias (lançamento de 61 dias atrás não conta); categoria inativa não
      entra; tipo errado não entra; família sem histórico recebe as primeiras do
      tipo; desempate por nome; o hook busca três meses e não repete a busca ao
      reabrir o painel.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(web): categorias mais usadas para o lançar`.

### Task 2: Painel de lançar novo

**Files:**

- Create: em `apps/web/src/components/lancar/`: `valor-do-lancamento.tsx`,
  `chips-de-categoria.tsx` (com "Todas", que abre a lista completa num painel),
  `chips-de-data.tsx`, `chips-de-pagamento.tsx`, `mais-opcoes.tsx`,
  `rodape-salvar.tsx`, e os testes
- Modify: `apps/web/src/components/transacao-modal.tsx` (vira a composição das
  partes) e o teste

**Comportamento:**

- Ordem de cima para baixo: alça, alternador Despesa/Receita e fechar; valor
  (com foco ao abrir uma transação nova) e microfone; Categoria; Quando; Pago
  com; "Descrição, parcelas e repetição" (expande); rodapé fixo.
- Trocar o tipo troca as mais usadas e descarta a categoria escolhida se ela
  não for do tipo novo (regra que o modal já tem e testa).
- "Quando": Hoje (padrão), Ontem, "Outra data" (mostra o campo de data; o chip
  mostra a data escolhida).
- "Pago com": um chip por forma de pagamento ativa; nenhum escolhido é válido.
  Parcelas só aparecem em "Mais opções" quando a forma escolhida é cartão de
  crédito.
- Rodapé: "Salvar despesa" ou "Salvar receita" (na edição, "Salvar
  alterações"); desabilitado sem valor ou sem categoria, com o motivo escrito
  logo acima; desabilitado também enquanto grava (não grava duas vezes).
- Edição: os campos vêm preenchidos; a categoria do lançamento aparece
  selecionada mesmo fora das seis (entra como sétimo chip); "Excluir" fica em
  "Mais opções".
- Voz: o microfone ao lado do valor chama o mesmo fluxo de voz de hoje; o
  preenchimento por voz continua funcionando.

- [ ] **Step 1: Escrever os testes que falham** para cada parte e para a
      composição: ordem dos blocos; foco no valor; chips com `aria-pressed`;
      "Todas" abrindo a lista e escolhendo uma categoria; Hoje/Ontem/Outra data
      gerando a data certa (Ontem em 1º de janeiro é 31 de dezembro do ano
      anterior); parcelas só com cartão de crédito; botão desabilitado e o
      motivo; não grava duas vezes; edição com categoria fora das seis; payload
      igual ao de hoje para os mesmos dados (compare com os testes atuais do
      modal); voz preenchendo.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar,** mantendo os testes atuais do modal que ainda
      valem e ajustando os que dependiam da forma antiga.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Marcar** as caixas "Lançar com valor primeiro e chips de
      categoria, data e pagamento", "Salvar fixo no rodapé e "Mais opções" para
      descrição, parcelas e repetição" e "Botão de voz visível".
- [ ] **Step 6: Commit** `feat(web): painel de lançar com valor primeiro e chips`.

### Task 3: Aviso "lançado" com desfazer e confirmação de exclusão

**Files:**

- Create: `apps/web/src/stores/aviso.store.ts`,
  `apps/web/src/components/aviso-lancado.tsx`,
  `apps/web/src/components/lancar/confirmar-exclusao.tsx`, e os testes
- Modify: `apps/web/src/hooks/use-lancamento.ts`,
  `apps/web/src/routes/area-logada.tsx` (onde o aviso é montado),
  `apps/web/src/components/transacao-modal.tsx`

**Interfaces:**

- `transacaoService.registrar` já devolve a transação criada; `useLancamento`
  passa a usá-la para montar o aviso.
- Produces: `useAvisoStore` com `aviso: { mensagem: string; desfazer?: () => Promise<void> } | null`,
  `mostrar(aviso)` e `fechar()`; o aviso some sozinho em 6 segundos e um aviso
  novo substitui o anterior.

**Comportamento:**

- Depois de salvar uma transação nova: "Despesa lançada" ou "Receita lançada".
  Com "Desfazer" só se não for parcelada nem recorrente; desfazer exclui aquele
  id, sinaliza a mudança para o Extrato e troca o aviso por "Lançamento
  desfeito". Se o desfazer falhar, o aviso diz "Não foi possível desfazer".
- Depois de salvar uma edição: "Alterações salvas", sem desfazer. Depois de
  excluir: "Lançamento excluído", sem desfazer.
- Aviso: acima da barra (`z-aviso`), 48px, `role="status"`; "Desfazer" é um
  botão de 44px.
- Excluir: no lugar do `window.confirm`, um painel (`z-painel` acima do painel
  de lançar) com o título "Excluir lançamento?", a descrição (ou categoria) e o
  valor, e os botões "Cancelar" e "Excluir" (este em `danger`).

- [ ] **Step 1: Escrever os testes que falham:** aviso de cada caso; desfazer
      exclui o id certo uma vez, mesmo se tocado duas vezes; sem desfazer para
      parcelado e recorrente; o aviso some em 6 segundos (relógio falso só do
      `setTimeout`); desfazer depois de navegar para outra tela ainda funciona;
      painel de exclusão no lugar do `window.confirm` (nenhuma chamada a
      `window.confirm`); cancelar não exclui.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Marcar** a caixa "Aviso "lançado" com desfazer e confirmação
      própria de exclusão".
- [ ] **Step 6: Commit** `feat(web): aviso de lançamento com desfazer e confirmação de exclusão`.

### Task 4: Testes E2E do lançar

**Files:**

- Modify: `apps/e2e/helpers/navegacao.ts` (ou um auxiliar novo
  `apps/e2e/helpers/lancar.ts`), `apps/e2e/tests/transacoes.spec.ts` e os specs
  que lançam pela tela (listar com `grep`)

- [ ] **Step 1: Concentrar o passo a passo de lançar num auxiliar** (abrir pelo
      "+", valor, tipo, categoria por chip ou por "Todas", data, forma de
      pagamento, mais opções, salvar) e usá-lo nos specs.
- [ ] **Step 2: Acrescentar ao `transacoes.spec.ts`:** lançar uma despesa e
      desfazer pelo aviso (a linha some do Extrato); excluir pelo painel de
      confirmação.
- [ ] **Step 3: Não rodar o Playwright.** Quem valida roda.
- [ ] **Step 4: Commit** `test(e2e): lançar pelo painel novo, desfazer e excluir`.
