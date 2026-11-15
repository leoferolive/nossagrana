# Nova UI — Entrega 1, PR 1 (Correções): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os cinco bugs funcionais da auditoria mobile (data padrão,
primeira parcela, "vigente desde", pizza com uma categoria e acentos), incluindo
os dados já gravados.

**Architecture:** correções pontuais nos módulos existentes, sem estrutura nova.
Os dois acertos de dado entram como migrations SQL seguras para rodar de novo,
testadas na suíte PostgreSQL. As datas do Web passam por `utils/date.ts`.

**Tech Stack:** Fastify + Drizzle + PostgreSQL (API), React + Vitest + Testing
Library (Web), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-11-15-nova-ui-entrega-1-design.md`
(seção "PR 1 — Correções").

O PR 2 (Base visual) ganha plano próprio depois do merge deste PR, porque quatro
arquivos daqui mudam de novo lá.

## Global Constraints

- Worktree `~/projetos/.wt/nossagrana-nova-ui-e1`, branch
  `feat/nova-ui-e1-correcoes`. Não usar o checkout principal: arquivos não
  rastreados em `apps/` impedem o marcador do quality gate.
- TDD: o teste falha antes de qualquer mudança de código de produção.
- Um commit por tarefa. Fluxo de cada commit: `git add <arquivos>` →
  `pnpm exec prettier --write <arquivos>` → `git add <arquivos>` →
  `CHANGED_FILES="$(git diff --cached --name-only)" pnpm quality` →
  `git commit`. Nunca `git add -A` nem `--no-verify`.
- Cada tarefa fecha marcando a própria caixa no Checkpoint de
  `docs/nova-ui/README.md` e acrescentando uma linha ao Diário, no mesmo commit.
- Sem `any`. Mensagens de erro e textos de interface em português, com acento.
- Migrations: cabeçalho comentado no padrão da `0012` (o que faz, por que é
  seguro), `SET LOCAL lock_timeout = '5s'`, e SQL que pode rodar mais de uma
  vez sem mudar o resultado.
- Suíte PostgreSQL: `bash scripts/test-pg.sh` (precisa de Docker). Ela não faz
  parte do `pnpm quality`; rodar à mão nas tarefas 2 e 5.

## Review Focus

1. **Parcelamento cujo pai já foi editado à mão** (`valor` diferente de
   `valor_total`): a migration não toca nele. Teste na Tarefa 2.
2. **Família que já tem "Saúde" além de "Saude"**: a migration não cria duas
   categorias de mesmo nome. Teste na Tarefa 5.
3. **Lançamento às 23:30 de 31/12**: a data padrão continua 31/12 do ano
   corrente. Teste na Tarefa 1.
4. **Snapshot de outra família no mesmo mês**: não vira divergente por causa
   do parcelamento de uma família vizinha. Teste na Tarefa 2.
5. **Pizza com uma categoria com valor e outras zeradas**: desenha o anel e
   não lista as zeradas. Teste na Tarefa 4.

---

### Task 1: Data padrão do lançamento em horário local

**Files:**

- Modify: `apps/web/vitest.config.ts`
- Modify: `apps/web/src/utils/date.ts`
- Test: `apps/web/src/utils/date.test.ts`
- Modify: `apps/web/src/components/transacao-modal.tsx:45`
- Test: `apps/web/src/components/transacao-modal.test.tsx`

**Interfaces:**

- Produces: `getTodayLocalISO(): string` em `utils/date.ts` — a data de hoje no
  fuso do dispositivo, em `YYYY-MM-DD`.

- [ ] **Step 1: Fixar o fuso dos testes do Web.** No topo de
      `apps/web/vitest.config.ts`, `process.env.TZ = 'America/Sao_Paulo';`, com
      comentário: os testes de data precisam do mesmo resultado em qualquer
      máquina, e com fuso UTC o bug desta tarefa não aparece. O pool é `forks`,
      então os processos filhos herdam a variável.

- [ ] **Step 2: Escrever os testes que falham** em `date.test.ts`:

```ts
describe('getTodayLocalISO', () => {
  afterEach(() => vi.useRealTimers());

  it('às 23:11 de 14/11 em São Paulo ainda é dia 14', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T02:11:00Z'));
    expect(getTodayLocalISO()).toBe('2026-11-14');
  });

  it('às 23:30 de 31/12 não vira o ano', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-01T02:30:00Z'));
    expect(getTodayLocalISO()).toBe('2026-12-31');
  });

  it('preenche mês e dia com zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T15:00:00Z'));
    expect(getTodayLocalISO()).toBe('2026-03-05');
  });
});
```

Em `transacao-modal.test.tsx`: com `vi.useFakeTimers({ toFake: ['Date'] })` e
relógio em `2026-11-15T02:11:00Z`, o modal de nova transação abre com o campo
`/^data$/i` valendo `2026-11-14`. Só o `Date` é falso, para não travar as
esperas da Testing Library.

- [ ] **Step 3: Rodar e ver falhar.**
      `pnpm --filter web test -- --run src/utils/date.test.ts src/components/transacao-modal.test.tsx`
      — esperado: FAIL (`getTodayLocalISO` não existe; modal mostra `2026-11-15`).

- [ ] **Step 4: Implementar** `getTodayLocalISO` com `getFullYear`, `getMonth` e
      `getDate`, e trocar o `today` local de `transacao-modal.tsx` por ela.

- [ ] **Step 5: Rodar e ver passar** (mesmo comando) e a suíte inteira do Web,
      já que o fuso mudou para todos os testes: `pnpm --filter web test -- --run`.

- [ ] **Step 6: Commit** `fix(web): data padrão do lançamento em horário local`.

### Task 2: Primeira parcela com o valor da parcela

**Files:**

- Modify: `apps/api/src/modules/transacao/transacao.plano-registro.ts:57`
- Test: `apps/api/src/modules/transacao/transacao.service.test.ts` (bloco UC07)
- Create: `apps/api/src/db/migrations/0013_parcela_pai_valor.sql` (e a entrada
  no `meta/_journal.json`, geradas por
  `pnpm --filter api exec drizzle-kit generate --custom --name=parcela_pai_valor --config=drizzle.config.ts`)
- Test: `apps/api/src/db/tests/parcela-pai-valor-migration.pg.test.ts`
- Modify: `docs/DECISIONS.md` (seção "Parcelas")

- [ ] **Step 1: Escrever o teste que falha** no bloco UC07 do service: compra de
      `300.00` em 3x no crédito gera pai com `valor` `'100.00'`, `valorTotal`
      `'300.00'`, `valorParcela` `'100.00'`, e a soma de `valor` do pai com as
      duas filhas dá `300`.

- [ ] **Step 2: Rodar e ver falhar.**
      `pnpm --filter api test -- --run src/modules/transacao/transacao.service.test.ts`
      — esperado: FAIL (`pai.valor` é `'300.00'`).

- [ ] **Step 3: Implementar.** Em `planejarParcelado`, o pai recebe
      `valor: valorParcela`, como as filhas.

- [ ] **Step 4: Rodar a suíte da API** (`pnpm --filter api test -- --run`).
      Teste que fixava o total no pai de um parcelamento passa a esperar o
      valor da parcela; nenhuma outra expectativa muda.

- [ ] **Step 5: Escrever o teste da migration** (padrão de
      `snapshot-unico-migration.pg.test.ts`: `criarBancoDescartavel`,
      `aplicarMigrationsAntesDe(banco.url, '0013_parcela_pai_valor')`, inserir o
      legado, `aplicarMigrations(banco.url)`). Casos:

  | Caso                                                                                  | Esperado depois da migration            |
  | ------------------------------------------------------------------------------------- | --------------------------------------- |
  | Pai legado: `valor` e `valor_total` `1299.90`, `valor_parcela` `129.99`, parcela 1/10 | `valor` `129.99`; `valor_total` intacto |
  | Filha do mesmo parcelamento (`valor` `129.99`)                                        | intacta                                 |
  | Pai já editado: `valor` `500.00`, `valor_total` `1299.90`                             | intacto                                 |
  | Transação não parcelada                                                               | intacta                                 |
  | Snapshot da família no mês do pai legado                                              | `divergente = true`                     |
  | Snapshot da mesma família em outro mês                                                | `divergente = false`                    |
  | Snapshot de outra família no mesmo mês                                                | `divergente = false`                    |
  | Executar de novo o SQL do arquivo da migration                                        | nenhum valor muda                       |

- [ ] **Step 6: Rodar e ver falhar.** `bash scripts/test-pg.sh` — esperado: FAIL
      (migration `0013_parcela_pai_valor` não existe).

- [ ] **Step 7: Criar a migration** com o SQL da spec (CTE `corrigidas` com
      `UPDATE transacoes ... RETURNING familia_id, mes_referencia`, seguida do
      `UPDATE snapshots_mensais ... SET divergente = true`). O cabeçalho explica
      a condição `valor = valor_total` e como desfazer
      (`SET valor = valor_total` no mesmo filtro).

- [ ] **Step 8: Rodar e ver passar.** `bash scripts/test-pg.sh`.

- [ ] **Step 9: Documentar** em `docs/DECISIONS.md`, seção "Parcelas": a
      transação original é a parcela 1 e também vale `valor_parcela`;
      `valor_total` guarda o total da compra.

- [ ] **Step 10: Commit**
      `fix(api): primeira parcela com o valor da parcela e correção dos já gravados`.

### Task 3: "Vigente desde" do orçamento no mês certo

**Files:**

- Modify: `apps/web/src/utils/date.ts`
- Test: `apps/web/src/utils/date.test.ts`
- Modify: `apps/web/src/pages/orcamento-page.tsx:173`
- Test: `apps/web/src/pages/orcamento-page.test.tsx`
- Modify: `apps/web/src/pages/cofrinho-detalhe-page.tsx:198`
- Test: `apps/web/src/pages/cofrinho-detalhe-page.test.tsx`

**Interfaces:**

- Produces: `formatMesCurto(mesReferencia: string): string` — `'2026-11'` vira
  `'nov. de 2026'`.
- Produces: `formatDataBR(dataISO: string): string` — `'2026-12-31'` vira
  `'31/12/2026'`. Só para datas sem hora; carimbos de data e hora
  (`registradoEm`, `geradoEm`) continuam com `new Date(...)`.

- [ ] **Step 1: Escrever os testes que falham.** Em `date.test.ts`:
      `formatMesCurto('2026-11')` é `'nov. de 2026'`, `formatMesCurto('2026-01')`
      é `'jan. de 2026'`, `formatDataBR('2026-12-31')` é `'31/12/2026'` e
      `formatDataBR('2026-03-01')` é `'01/03/2026'`. Em `orcamento-page.test.tsx`:
      orçamento com `vigenciaInicio: '2026-03'` mostra o texto
      `Vigente desde mar. de 2026`. Em `cofrinho-detalhe-page.test.tsx`: aporte
      recorrente com `dataFimRecorrencia: '2026-12-31'` mostra `31/12/2026`.

- [ ] **Step 2: Rodar e ver falhar.**
      `pnpm --filter web test -- --run src/utils/date.test.ts src/pages/orcamento-page.test.tsx src/pages/cofrinho-detalhe-page.test.tsx`
      — esperado: FAIL (funções não existem; as páginas mostram `fev. de 2026` e
      `30/12/2026`).

- [ ] **Step 3: Implementar** as duas funções montando a data com ano, mês e
      dia numéricos (como `formatMesLabel`), e usá-las nas duas páginas.

- [ ] **Step 4: Rodar e ver passar** (mesmo comando).

- [ ] **Step 5: Commit** `fix(web): "vigente desde" e data fim de recorrência no fuso local`.

### Task 4: Gráfico de pizza com uma única categoria

**Files:**

- Modify: `apps/web/src/components/charts/pie-chart.tsx`
- Test (create): `apps/web/src/components/charts/pie-chart.test.tsx`

- [ ] **Step 1: Escrever os testes que falham** (`size` padrão de 120):

  | Entrada                              | Esperado                                                                                                               |
  | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
  | `[{ label: 'Moradia', value: 500 }]` | um `<circle>` com `r="40.8"`, `stroke-width="19.2"` e `fill="none"`; nenhum `<path>`; legenda com `Moradia` e `(100%)` |
  | `[{ Moradia: 500 }, { Lazer: 0 }]`   | o mesmo anel; `Lazer` não aparece na legenda                                                                           |
  | `[{ Moradia: 300 }, { Lazer: 100 }]` | dois `<path>`, nenhum `<circle>`; legenda com `(75%)` e `(25%)`                                                        |
  | `[]` e `[{ Moradia: 0 }]`            | não renderiza nada                                                                                                     |

- [ ] **Step 2: Rodar e ver falhar.**
      `pnpm --filter web test -- --run src/components/charts/pie-chart.test.tsx`
      — esperado: FAIL (um `<path>` degenerado no lugar do anel; `Lazer` listado).

- [ ] **Step 3: Implementar.** Itens com valor menor ou igual a zero saem antes
      do cálculo. Quando sobra um único item, o gráfico desenha um `<circle>` de
      raio `(outerR + innerR) / 2` com traço de largura `outerR - innerR` na cor
      da fatia; com dois ou mais, continua com `describeArc`.

- [ ] **Step 4: Rodar e ver passar** (mesmo comando).

- [ ] **Step 5: Commit** `fix(web): gráfico de pizza com uma única categoria`.

### Task 5: Acentos nas categorias padrão e nos textos

**Files:**

- Modify: `apps/api/src/db/seeds/categorias-padrao.ts`
- Modify: `apps/api/src/db/seeds/templates-padrao.ts`
- Modify: `apps/api/src/scripts/seed-templates.ts`
- Test (create): `apps/api/src/db/seeds/templates-padrao.test.ts`
- Create: `apps/api/src/db/migrations/0014_categorias_padrao_acentos.sql`
  (gerada com `--custom --name=categorias_padrao_acentos`)
- Test: `apps/api/src/db/tests/categorias-acentos-migration.pg.test.ts`
- Modify (textos): `apps/web/src/components/cofrinho-aporte-modal.tsx:94`,
  `cofrinho-encerrar-modal.tsx:84`, `cofrinho-retirada-modal.tsx:94,100,127`,
  `apps/web/src/pages/cofrinho-detalhe-page.tsx:205,209,216,218`,
  `apps/web/src/pages/onboarding-page.tsx:184,229`, `apps/web/vite.config.ts`
  (descrição do manifest)
- Modify (E2E): `apps/e2e/tests/onboarding.spec.ts`, `apps/e2e/tests/familia.spec.ts`

**Nomes:**

| Tipo    | Antes         | Depois        |
| ------- | ------------- | ------------- |
| despesa | `Alimentacao` | `Alimentação` |
| despesa | `Saude`       | `Saúde`       |
| despesa | `Educacao`    | `Educação`    |
| receita | `Salario`     | `Salário`     |
| receita | `Bonus`       | `Bônus`       |

**Textos do Web:**

| Antes                                        | Depois                                       |
| -------------------------------------------- | -------------------------------------------- |
| `Sera registrado como saida no mes atual.`   | `Será registrado como saída no mês atual.`   |
| `O valor retorna como receita no mes atual.` | `O valor retorna como receita no mês atual.` |
| `Valor excede o saldo disponivel.`           | `Valor excede o saldo disponível.`           |
| `Descricao (opcional)`                       | `Descrição (opcional)`                       |
| `Cancelar recorrencia` (rótulo e texto)      | `Cancelar recorrência`                       |
| `Movimentacoes`                              | `Movimentações`                              |
| `Nenhuma movimentacao registrada.`           | `Nenhuma movimentação registrada.`           |
| `Criar familia` / `Buscar familia`           | `Criar família` / `Buscar família`           |
| `PWA de gestao financeira familiar`          | `PWA de gestão financeira familiar`          |

- [ ] **Step 1: Escrever os testes que falham.**
  - `templates-padrao.test.ts`: todo item de `TEMPLATES_PADRAO` aponta para uma
    categoria que existe em `CATEGORIAS_PADRAO_RECEITA` ou
    `CATEGORIAS_PADRAO_DESPESA`, conforme o `tipo`; e as listas padrão contêm
    `Alimentação`, `Saúde`, `Educação`, `Salário` e `Bônus`.
  - Testes das cinco telas do Web que procuram os textos da tabela passam a
    procurar a forma acentuada.
  - Migration (mesmo padrão da Tarefa 2), casos:

  | Caso                                                  | Esperado depois da migration |
  | ----------------------------------------------------- | ---------------------------- |
  | Família só com `Saude` (despesa)                      | vira `Saúde`                 |
  | Família com `Salario` e `Bonus` (receita)             | viram `Salário` e `Bônus`    |
  | Família que já tem `Saúde` e também `Saude` (despesa) | `Saude` intacta              |
  | Categoria `Saude` de tipo receita (fora da tabela)    | intacta                      |
  | Categoria `Moradia`                                   | intacta                      |
  | Executar de novo o SQL do arquivo                     | nenhum nome muda             |

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter api test -- --run`,
      `pnpm --filter web test -- --run` e `bash scripts/test-pg.sh`.

- [ ] **Step 3: Implementar.** Trocar os nomes nos três arquivos de seed e os
      textos do Web. A migration faz um `UPDATE categorias ... FROM (VALUES ...)`
      com as cinco linhas da tabela de nomes, comparando `nome` e `tipo`, com
      `NOT EXISTS` para a família que já tem o nome novo no mesmo tipo.

- [ ] **Step 4: Ajustar os testes que usavam os nomes antigos** como nome de
      categoria padrão na API, e os dois specs do E2E que procuram
      `Criar familia` e `Buscar familia`.

- [ ] **Step 5: Rodar e ver passar** (os três comandos do Step 2).

- [ ] **Step 6: Commit** `fix: acentos nas categorias padrão e nos textos de cofrinho e onboarding`.

### Task 6: Validação no navegador e abertura do PR

- [ ] **Step 1: Subir o ambiente isolado** (seção "Ambiente para validar no
      navegador" do README): banco do E2E na 5433, API apontando para ele, Web
      na 5180.

- [ ] **Step 2: Refazer os cenários em 390×844 com o `agent-browser`**, com
      captura de cada um:
  1. Família nova: categorias aparecem como Alimentação, Saúde, Educação,
     Salário e Bônus.
  2. Compra de R$ 1.299,90 em 10x no crédito: o mês da compra mostra
     R$ 129,99.
  3. Orçamento criado no mês corrente mostra "Vigente desde" com o mês
     corrente.
  4. Dashboard com despesas em uma única categoria mostra o anel completo.
  5. Tela de detalhe do cofrinho mostra "Movimentações".

  A data padrão depois das 21h não é reproduzível no navegador fora desse
  horário; vale o teste da Tarefa 1.

- [ ] **Step 3: Rodar o E2E dos specs alterados**
      (`onboarding.spec.ts`, `familia.spec.ts`, `transacoes.spec.ts`).

- [ ] **Step 4: Encerrar o ambiente**
      (`docker compose -f apps/e2e/docker-compose.e2e.yml down -v`).

- [ ] **Step 5: Abrir o PR** com a descrição em quatro blocos (o que mudou, por
      que mudou, como testar, o que pode quebrar). Em "o que pode quebrar":
      as duas migrations rodam na subida da API; os totais de meses com compra
      parcelada caem e os snapshots desses meses ficam divergentes; como
      desfazer cada migration. O merge fica com o usuário.
