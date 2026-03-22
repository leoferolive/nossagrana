# Auditoria UX — NossaGrana

> Avaliação feita em 2026-03-19, navegando pelo app com Playwright usando dados reais de 2025 (206 transações importadas via seed:xlsx).
> Login: leoferolive@gmail.com, Família: "Teste Oliveira"

---

## BUGS CRÍTICOS

### BUG-01: Tour de onboarding bloqueia TODA a navegação

- **Severidade:** Crítica
- **Onde:** Qualquer tela após o primeiro acesso
- **Problema:** O tour "Bem-vindo ao NossaGrana!" (4 steps) aparece como overlay modal e intercepta pointer events em toda a tela. Clicar em itens da sidebar, bottom nav ou qualquer botão sob o overlay é impossível. O tour reaparece ao navegar para o Extrato (step "1 de 4" novamente).
- **Impacto:** Usuário fica preso na dashboard. No Playwright, nenhuma tela após o Extrato foi acessível no desktop — todas as screenshots (Relatórios, Histórico, Categorias, Cartões, Orçamento, Família, Ajuda) mostram a mesma página do Extrato com o tour bloqueando.
- **Sugestão:** (1) Persistir estado do tour em localStorage para não repetir. (2) Tornar o tour dismissível por Escape ou clique fora. (3) Não bloquear navegação enquanto tour estiver ativo.

### BUG-02: Dashboard sem navegação de meses

- **Severidade:** Crítica
- **Onde:** Dashboard (mobile e desktop)
- **Problema:** O dashboard mostra "Fevereiro De 2026" com R$ 0,00 em tudo. Não há setas/botões visíveis para navegar para meses anteriores (onde os dados de 2025 estão). O mês exibido parece estar hardcoded ou usando o mês anterior ao atual, não o mês corrente.
- **Impacto:** Usuário com dados de 2025 vê tudo zerado e não consegue navegar para ver seus dados.
- **Sugestão:** Adicionar setas ◀ ▶ para navegar entre meses. Considerar ir automaticamente para o último mês com dados na primeira visita.

### BUG-03: Extrato mostra UUID em vez de nome do método de pagamento

- **Severidade:** Alta
- **Onde:** Tela de Extrato, coluna "Pagamento"
- **Problema:** A coluna "Pagamento" exibe o UUID completo do método de pagamento (ex: `92c6e507-b7a0-42d3-b1f1-e75d03d05f5f`) em vez do nome ("Dinheiro").
- **Sugestão:** Fazer JOIN/lookup para exibir o nome do método de pagamento.

### BUG-04: Ícones quebrados no modal "Nova Transação"

- **Severidade:** Média
- **Onde:** Modal de Nova Transação, área inferior
- **Problema:** Dois caracteres "? ?" aparecem antes dos botões "Parcelado" e "Recorrente". São ícones que não carregaram.
- **Sugestão:** Verificar se os ícones são de uma biblioteca que não está sendo importada, ou substituir por ícones SVG.

### BUG-05: Data em formato americano (MM/DD/YYYY)

- **Severidade:** Média
- **Onde:** Modal de Nova Transação, campo "Data"
- **Problema:** O date picker nativo mostra "03/19/2026" (formato americano) em vez de "19/03/2026" (formato brasileiro). App é para família brasileira.
- **Sugestão:** Usar `<input type="date">` com locale BR, ou implementar um date picker customizado com formato DD/MM/YYYY.

---

## PROBLEMAS DE UX

### UX-01: Extrato sem paginação — lista infinita de 16.000px

- **Onde:** Tela de Extrato (mobile e desktop)
- **Problema:** Todas as 206 transações são renderizadas de uma vez. No mobile, a página tem 16.259px de altura (!). Scroll interminável, performance ruim, impossível encontrar uma transação específica.
- **Sugestão:** (1) Paginação ou virtual scrolling. (2) Agrupar por mês com headers colapsáveis. (3) Adicionar busca/filtro por texto. (4) Limitar a exibição ao mês selecionado por padrão.

### UX-02: Extrato sem coluna de categoria

- **Onde:** Tela de Extrato
- **Problema:** Colunas são: Data | Descrição | Pagamento | Valor. Não há coluna de Categoria, que é uma das informações mais importantes para o usuário entender seus gastos.
- **Sugestão:** Adicionar coluna de categoria com badge colorido.

### UX-03: Extrato não tem filtro por mês

- **Onde:** Tela de Extrato
- **Problema:** Mostra TODAS as transações do ano inteiro. Não há seletor de mês como no dashboard.
- **Sugestão:** Reutilizar o mesmo seletor de mês do dashboard no extrato.

### UX-04: Dashboard vazio sem orientação

- **Onde:** Dashboard quando mês não tem dados
- **Problema:** Cards de "Despesas por Categoria" e "Orçamento" mostram texto simples ("Nenhuma transação registrada", "Nenhum orçamento configurado") sem nenhum visual orientador.
- **Sugestão:** Empty states com ícone ilustrativo e CTA claro ("Adicionar transação", "Configurar orçamento").

### UX-05: Cards do dashboard com bordas coloridas fortes

- **Onde:** Dashboard, cards de Receitas/Despesas/Saldo
- **Problema:** Os três cards têm bordas left/top grossas em verde/vermelho/azul que são visualmente pesadas. O estilo é funcional mas pouco refinado.
- **Sugestão:** Usar indicadores de cor mais sutis (barra lateral fina, cor de fundo leve, ou só a cor no texto do label).

### UX-06: Sidebar sem agrupamento visual

- **Onde:** Sidebar desktop
- **Problema:** 11 itens de navegação em lista plana sem separação visual entre grupos lógicos. Os separadores existem entre "Orçamento" e "Família" e entre "Alternar Família" e "Ajuda", mas são apenas espaçamento.
- **Sugestão:** Usar labels de seção (ex: "Finanças", "Configurações", "Conta") ou dividers mais explícitos.

### UX-07: Botão "+ Nova" duplicado no mobile

- **Onde:** Mobile, header e FAB
- **Problema:** Há um botão "+ Nova" no header top-right E um FAB "+" no bottom-right. Dois CTAs para a mesma ação competem pela atenção.
- **Sugestão:** Manter apenas o FAB no mobile (mais acessível com polegar).

### UX-08: Modal de transação — select nativo para Categoria e Método

- **Onde:** Modal Nova Transação
- **Problema:** Os campos Categoria e Método de Pagamento usam `<select>` nativo, que não pode ser estilizado e quebra a estética dark do app.
- **Sugestão:** Implementar dropdown customizado com o design system do app.

### UX-09: Sem feedback visual de "tipo" na transação

- **Onde:** Extrato
- **Problema:** Receitas e despesas são diferenciadas apenas pelo sinal "+" antes do valor. Sem cor, ícone ou badge para distinguir visualmente.
- **Sugestão:** Usar cor verde para receitas e vermelho para despesas no valor. Adicionar ícone de categoria.

### UX-10: Mês do dashboard diz "Fevereiro De 2026" (deveria ser Março)

- **Onde:** Dashboard
- **Problema:** Hoje é 19/03/2026 mas o dashboard mostra "Fevereiro De 2026". Parece haver um bug de cálculo do mês atual (off-by-one).
- **Sugestão:** Verificar lógica de `mesReferencia` — pode estar usando `getMonth()` sem +1.

---

## FUNCIONALIDADES FALTANDO

### FEAT-01: Navegação por meses no dashboard

Setas para avançar/voltar entre meses de referência. Essencial para consultar histórico.

### FEAT-02: Filtro por mês no extrato

O extrato precisa de seletor de mês, não mostrar tudo de uma vez.

### FEAT-03: Busca no extrato

Filtrar transações por texto (descrição, categoria, valor).

### FEAT-04: Gráfico de categorias no dashboard

A seção "Despesas por Categoria" existe mas só mostra texto. Falta o gráfico de pizza/barras.

### FEAT-05: Evolução mensal (sparkline/tendência)

Nos cards de Receitas/Despesas/Saldo, mostrar tendência vs mês anterior.

### FEAT-06: Edição inline de transação

Clicar em uma transação no extrato deveria abrir o modal de edição preenchido.

### FEAT-07: Confirmação ao excluir transação

Não foi possível testar delete, mas deve ter confirmação modal.

### FEAT-08: Relatórios

Não foi possível acessar a tela de Relatórios (bloqueada pelo tour). Verificar se tem conteúdo real ou é placeholder.

### FEAT-09: Exportação de dados

Permitir exportar extrato como CSV/PDF para controle externo.

### FEAT-10: Indicador visual da família ativa

No header/sidebar, mostrar qual família está selecionada (especialmente para quem tem mais de uma).

---

## PROBLEMAS DE DESIGN VISUAL

### DES-01: Dark mode sem hierarquia de superfícies

Background, cards, sidebar, inputs — tudo no mesmo tom escuro. Sem layering sutil.

### DES-02: Bordas harsh nos cards do dashboard

Bordas coloridas grossas nos cards de resumo são visualmente pesadas.

### DES-03: Labels em CAPS LOCK

"RECEITAS", "DESPESAS", "SALDO", "DESPESAS POR CATEGORIA", "ORÇAMENTO" — tudo em uppercase, que grita visualmente.

### DES-04: Tabela do extrato sem espaçamento respirável

Linhas muito juntas, sem alternância de cor, sem hover state visível.

### DES-05: Botão "Salvar Transação" é vermelho/coral

Para uma ação positiva (salvar), vermelho é confuso — sugere perigo/delete.

### DES-06: Gradiente verde no background (login e telas auth)

Gradiente verde no canto superior esquerdo é decorativo sem propósito.

---

## PRIORIZAÇÃO SUGERIDA

### P0 — Corrigir AGORA (app não é utilizável sem)

1. **BUG-01** — Tour bloqueia navegação
2. **BUG-02** — Dashboard sem navegação de meses
3. **UX-01** — Extrato sem paginação/filtro mensal
4. **BUG-03** — UUID no extrato

### P1 — Próxima iteração (UX essencial)

5. **FEAT-01** — Navegação por meses
6. **FEAT-02** — Filtro por mês no extrato
7. **UX-02** — Coluna de categoria no extrato
8. **UX-10** — Mês off-by-one
9. **BUG-04** — Ícones quebrados
10. **BUG-05** — Formato de data

### P2 — Qualidade de vida

11. **UX-04** — Empty states com orientação
12. **UX-09** — Cores receita/despesa no extrato
13. **FEAT-04** — Gráfico de categorias
14. **FEAT-06** — Edição inline de transação
15. **FEAT-03** — Busca no extrato

### P3 — Polish / Design

16. **DES-01 a DES-06** — Refinamento visual
17. **UX-05 a UX-08** — Ajustes de UI
18. **FEAT-05, 09, 10** — Features complementares

---

## NOTAS DA NAVEGAÇÃO

- **Mobile (390x844):** Login OK, seleção de família OK, dashboard vazio (sem nav de meses), FAB não capturado, extrato carregou todas 206 transações (16259px!), tour bloqueou navegação para Relatórios e Config.
- **Desktop (1440x900):** Login OK, seleção de família OK, dashboard vazio, modal Nova Transação OK (capturado), Extrato carregou com tour de onboarding sobreposto, tour impediu navegação para todas as telas subsequentes.
- **Screenshots salvos em:** `audit-screenshots/`
