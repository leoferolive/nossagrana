# Nova UI — Entrega 3, PR 2 (Extrato): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** redesenhar o miolo do Extrato: lista por dia do mais recente para o
mais antigo, com data legível e total do dia; resumo do período; filtros,
busca e mais ações; e a lista atualizada na hora depois de salvar, editar ou
excluir um lançamento.

**Architecture:** o cálculo (agrupar por dia, rótulo do dia, totais, resumo)
fica em funções puras em `apps/web/src/utils/extrato.ts`, testadas sem tela. A
página só monta componentes pequenos em `apps/web/src/components/extrato/`. A
atualização depois de gravar usa um contador na store de transações, que o
`useLancamento` incrementa a cada gravação e o Extrato observa para recarregar.

**Tech Stack:** React 19, Zustand, Tailwind 3, `lucide-react`, Vitest +
Testing Library, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-11-16-nova-ui-entrega-3-design.md`
(seções "Extrato", "Objetivos" 1 a 3, "O que seria um fracasso"). Medidas e
cores: "Sistema visual" de `docs/nova-ui/README.md` (Linha de lançamento,
Cabeçalho de dia, Chip, ícone de categoria). Roteiro: seção "Extrato" de
`docs/nova-ui/telas.md`.

## Global Constraints

- Só `apps/web`, `apps/e2e` e os documentos. Nenhuma mudança na API nem em
  `packages/types`.
- O endereço `/extrato`, o cabeçalho de aba com a pílula de mês e a barra
  inferior não mudam.
- A data do lançamento é texto `AAAA-MM-DD` sem hora: agrupar e rotular sem
  converter fuso (nunca `new Date('AAAA-MM-DD')`, que é UTC). "Hoje" e "Ontem"
  vêm de `getTodayLocalISO` (`utils/date.ts`).
- Valores: soma em centavos inteiros (nunca somar `number` de reais com casas
  decimais); exibição com `formatBRL`.
- Cores conforme a decisão 9: entrada em verde, saída em texto neutro, vermelho
  só para saldo negativo.
- Tokens existentes; ícones só de `lucide-react`; alvos de 44px; campos em
  16px; sem emoji.
- Sem `any`. Arquivo com até 500 linhas, função curta, sem prop drilling novo.
- TDD: o teste falha antes da mudança de produção.
- Um commit por tarefa. Fluxo: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`.
- Cada tarefa acrescenta uma linha ao Diário de `docs/nova-ui/README.md`; as
  caixas da Entrega 3 ligadas ao Extrato são marcadas na tarefa que as conclui.

## Review Focus

1. **Lançamento das 23h do último dia do mês:** aparece no dia certo e no mês
   certo.
2. **Total do dia e resumo:** batem com a soma das linhas mostradas, inclusive
   com filtro e busca ativos.
3. **Parcela e recorrência:** cada parcela aparece no dia dela, com "3/10" no
   metadado; o resumo soma só o que está no mês.
4. **Gravar com o Extrato aberto:** a lista e o resumo mudam sem sair da tela;
   gravar em outro mês não põe o lançamento no mês errado da lista.
5. **Mês sem lançamentos, e busca sem resultado:** mensagens diferentes.

---

### Task 1: Cálculo do Extrato

**Files:**

- Create: `apps/web/src/utils/extrato.ts`, `apps/web/src/utils/extrato.test.ts`

**Interfaces:**

- Produces: `agruparPorDia(transacoes: Transacao[]): DiaDoExtrato[]` — dias do
  mais recente para o mais antigo; dentro do dia, a ordem que a API devolveu.
  `DiaDoExtrato = { data: string; transacoes: Transacao[]; totalCentavos: number }`
  (total do dia = entradas − saídas).
- Produces: `rotuloDoDia(data: string, hoje: string): string` — "Hoje · seg, 16
  nov", "Ontem · dom, 15 nov", e para os demais "Sex, 13 nov" (dia da semana
  abreviado com a primeira letra maiúscula, dia sem zero à esquerda, mês
  abreviado sem ponto).
- Produces: `resumoDoPeriodo(transacoes: Transacao[]): { entradasCentavos: number; saidasCentavos: number; saldoCentavos: number }`.
- Produces: `paraCentavos(valor: string): number` (valor da API, ex. `'129.90'`).

- [ ] **Step 1: Escrever os testes que falham:** agrupamento e ordem (três dias
      fora de ordem viram três grupos do mais recente ao mais antigo); total do
      dia com entrada e saída; `rotuloDoDia` para hoje, ontem, outro dia e
      virada de ano (`2026-12-31` com hoje `2027-01-01` é "Ontem"); resumo com
      saldo negativo; centavos sem erro de arredondamento (`0.10` + `0.20`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar,** montando datas com ano, mês e dia numéricos.
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(web): cálculo do extrato por dia e resumo do período`.

### Task 2: Lista atualizada depois de gravar

**Files:**

- Modify: `apps/web/src/stores/transacao.store.ts`,
  `apps/web/src/hooks/use-lancamento.ts`, `apps/web/src/pages/extrato-page.tsx`
- Test: `apps/web/src/stores/transacao.store.test.ts` (criar se não existir),
  `apps/web/src/hooks/use-lancamento` (teste existente ou novo),
  `apps/web/src/App.lancar.test.tsx`

**Interfaces:**

- Produces: na store, `versao: number` e `sinalizarMudanca(): void` (incrementa
  `versao`).
- `useLancamento`: depois de `registrar`, `atualizar` e `excluir` terminarem com
  sucesso, chama `sinalizarMudanca()`. Falha não sinaliza.
- `ExtratoPage`: recarrega a lista do mês quando `versao` muda.

- [ ] **Step 1: Escrever os testes que falham:** com o Extrato aberto, lançar
      uma receita pelo "+" faz a linha nova aparecer sem sair da tela; editar o
      valor muda a linha; excluir tira a linha; uma falha ao gravar não recarrega.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Marcar** a caixa "Lista do Extrato atualizada logo depois de
      salvar ou excluir um lançamento".
- [ ] **Step 6: Commit** `fix(web): extrato atualiza a lista depois de salvar, editar ou excluir`.

### Task 3: Ícone e cor de categoria

**Files:**

- Create: `apps/web/src/components/extrato/icone-categoria.tsx` e o teste

**Interfaces:**

- Produces: `<IconeCategoria nome={string} />` — quadrado de 38×38, raio 12,
  fundo claro e ícone escuro da mesma família.

**Famílias (do README, "Ícone de categoria"):**

| Família     | Categorias (nome sem acento, minúsculo, contém) | Fundo     | Tinta     | Ícone lucide       |
| ----------- | ----------------------------------------------- | --------- | --------- | ------------------ |
| Alimentação | alimenta, mercado, supermercado                 | `#F6ECCD` | `#8A5A00` | `ShoppingBasket`   |
| Saúde       | saude, farmacia                                 | `#F7E1DE` | `#B3261E` | `HeartPulse`       |
| Lazer       | lazer                                           | `#ECE6F6` | `#5B3FA6` | `Ticket`           |
| Compras     | compra                                          | `#E1ECF5` | `#1F5F8B` | `ShoppingBag`      |
| Outros      | qualquer outra                                  | `#E6E9E3` | `#45524A` | `CircleDollarSign` |

As cores entram como tokens no `tailwind.config.ts` (`cat-*-bg`, `cat-*-ink`),
não como hexadecimal nos componentes. As demais categorias padrão (Moradia,
Transporte, Educação, Assinaturas, Salário, Bônus, Investimentos, Cofrinho)
ganham ícone próprio na família "Outros".

- [ ] **Step 1: Escrever os testes que falham:** cada família pelo nome com e
      sem acento; categoria desconhecida cai em "Outros"; o ícone tem
      `aria-hidden`; contraste da tinta sobre o fundo ≥ 4,5:1 (no
      `tokens.test.ts`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** `feat(web): ícone e cor por família de categoria`.

### Task 4: Tela do Extrato

**Files:**

- Create: em `apps/web/src/components/extrato/`: `resumo-do-periodo.tsx`,
  `filtros-do-extrato.tsx`, `cabecalho-do-dia.tsx`, `linha-de-lancamento.tsx`,
  e os testes
- Modify: `apps/web/src/pages/extrato-page.tsx` e o teste

**Medidas (README, "Componentes"):**

- Resumo: cartão com três colunas (Entradas em `text-success`, Saídas em
  `text-text`, Saldo em `text-text` ou `text-danger` se negativo); rótulo
  12/600 `text-dim`, valor 18/800 `tabular-nums`.
- Filtros: chips de 44px (Tudo, Saídas, Entradas) com `aria-pressed`;
  selecionado com fundo `success` e texto branco. À direita, botão "Buscar"
  (abre o campo de busca, que recebe o foco) e botão "Mais ações" (abre um menu
  com "Exportar CSV").
- Cabeçalho de dia: 34px, 12/700 em caixa alta `text-dim`, total do dia à
  direita (positivo em verde com "+", negativo neutro com "−").
- Linha: mínimo 52px, `IconeCategoria`, título 15/600 com reticências (a
  descrição ou, sem descrição, o nome da categoria), metadado 12px `text-dim`
  ("Categoria · Forma de pagamento", e "· 3/10" quando parcela), valor 15/700 à
  direita (entrada verde com "+", saída neutra com "−"). A linha inteira é um
  botão que abre a edição (`abrirEdicao`), com nome acessível que inclui
  descrição e valor.

- [ ] **Step 1: Escrever os testes que falham:** ordem dos dias e rótulos;
      total do dia; resumo acompanhando filtro e busca; chips com
      `aria-pressed`; busca escondida até tocar em "Buscar"; "Exportar CSV"
      dentro de "Mais ações" e gerando o mesmo CSV de hoje; parcela "3/10";
      estados de carregando, erro com "Tentar de novo", mês vazio ("Nenhum
      lançamento em novembro") e busca sem resultado ("Nada encontrado para
      'xyz'"); tocar numa linha abre a edição.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** O que não mudar de comportamento (exportar CSV,
      busca por descrição) mantém a lógica de hoje.
- [ ] **Step 4: Rodar e ver passar** a suíte do Web inteira.
- [ ] **Step 5: Marcar** as caixas "Extrato em ordem cronológica, agrupado por
      dia, com total do dia" e "Resumo do período, filtros e busca".
- [ ] **Step 6: Commit** `feat(web): extrato por dia com resumo, filtros e busca`.

### Task 5: Testes E2E do Extrato

**Files:**

- Modify: `apps/e2e/tests/transacoes.spec.ts` (e outros specs que procurem
  texto do Extrato antigo; listar com `grep`)

- [ ] **Step 1: Ajustar** as afirmações sobre o Extrato à tela nova e tirar o
      `test.fixme` de "lançar com o Extrato aberto atualiza a lista".
- [ ] **Step 2: Não rodar o Playwright.** Quem valida roda os specs alterados
      no ambiente isolado.
- [ ] **Step 3: Commit** `test(e2e): extrato novo e lista que atualiza`.
