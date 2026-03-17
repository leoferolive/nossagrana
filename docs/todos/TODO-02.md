# TODO-02 — Gráficos SVG

**Status:** ✅ Concluído

## Escopo

Gráficos SVG nativos — sem Chart.js ou outras libs externas.

- `MiniChart`: polyline SVG com pontos, suporta `fill` (área preenchida) e `showDots`
- `PieChart`: donut no desktop (círculo central vazio), pizza no mobile, com legenda lateral
- `BudgetBar`: barra horizontal de progresso com cores por threshold (verde/amarelo/vermelho), % no desktop

## Resultado

Implementados em `apps/web/src/components/charts/`:

- `mini-chart.tsx`
- `pie-chart.tsx`
- `budget-bar.tsx`
