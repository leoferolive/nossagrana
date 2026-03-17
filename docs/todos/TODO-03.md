# TODO-03 — Dashboard mobile + desktop

**Status:** ✅ Concluído

## Escopo

`DashboardPage` responsiva usando os componentes de charts:

**Mobile:**

- Header com mês, família e avatar do usuário
- 3 cards de resumo: Receitas / Despesas / Saldo
- Card PieChart "Despesas por Categoria"
- Card MiniChart "Evolução no Mês" com labels de data
- BudgetBars "Orçamento"
- Card de insight (💡)

**Desktop:**

- Mesma estrutura em grid 2 colunas para PieChart + MiniChart
- SummaryBox cards em linha (flex)
- Grid inferior: Orçamento + Últimas Transações (5 items)
- Card de insight em row

## Resultado

Implementado em `apps/web/src/pages/dashboard-page.tsx`
