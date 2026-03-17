# TODO-08 — Config Screens

**Status:** ⬜ Pendente (revisão e alinhamento)

## Objetivo

Verificar e completar o alinhamento das telas de configuração com os wireframes.

## Arquivos envolvidos

- `apps/web/src/pages/configuracoes-page.tsx`
- `apps/web/src/pages/categorias-page.tsx`
- `apps/web/src/pages/metodos-pagamento-page.tsx`
- `apps/web/src/pages/orcamento-page.tsx`
- `apps/web/src/pages/family-settings-page.tsx`
- `apps/web/src/pages/perfil-page.tsx`

## Referência: wireframes

### ConfigScreen (hub) — mobile

```
- Título "Configurações"
- Lista vertical de itens com: ícone (20px) + label (14px bold) + "›" à direita
- Itens: 🏷️ Categorias, 💳 Cartões/Pagamentos, 🎯 Orçamento Mensal,
         👨‍👩‍👧‍👦 Família, 📅 Histórico de Meses, 👤 Perfil/Conta
- Hover: bg levemente mais claro
```

### CategoriasScreen — mobile

```
- "← Voltar" (verde, 13px)
- Título "Categorias"
- Seção "DESPESAS" (uppercase, muted, 12px)
- Lista: Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Assinaturas, Compras
  - Cada item: nome + "editar" à direita (pequeno, cursor pointer)
  - Separador border-bottom
- Seção "RECEITAS"
- Lista: Salário, Bônus, Investimentos
- Botão "＋ Nova Categoria" (centrado, verde)
```

### CategoriasScreen — desktop

```
- Header: "Categorias" + botão "＋ Nova Categoria" (à direita)
- Grid 2 colunas: Card Despesas | Card Receitas
```

### CartoesScreen — mobile

```
- "← Voltar"
- Título "Cartões e Pagamentos"
- Cards por cartão: nome + tipo + datas de fechamento/vencimento (crédito) | tipo (outros) + usuário + ícone
- Botão "＋ Novo Método" (centrado, verde)
```

### CartoesScreen — desktop

```
- Header: título + botão "＋ Novo Método"
- Grid 2 colunas: cards com ícone colorido, nome, dono, e fechamento/vencimento (crédito)
```

### OrcamentoScreen — mobile

```
- "← Voltar"
- Título + subtítulo "Vigente desde Mar/2026"
- Cards por categoria com BudgetBar + "editar limite" à direita
```

### OrcamentoScreen — desktop

```
- Título + subtítulo
- Tabela: Categoria | Limite | Gasto | Disponível | Progresso (barra inline + %) | [editar]
```

## Critérios de Aceite

1. ConfigHub lista todos os itens com ícone + label + chevron
2. Categorias mobile: seções DESPESAS/RECEITAS com separadores + botão Nova Categoria
3. Categorias desktop: grid 2 colunas
4. Cartões mobile: cards compactos; desktop: grid 2 colunas com ícone colorido
5. Orçamento mobile: BudgetBars por categoria; desktop: tabela com barra inline
6. Testes existentes continuam passando; novos comportamentos têm cobertura

## Notas

- Verificar se `configuracoes-page.tsx` já tem todos os 6 itens com ícones corretos
- `family-settings-page.tsx` e `perfil-page.tsx` são sub-telas de config — verificar se estão acessíveis a partir do hub
- `historico-page.tsx` já foi alinhado no TODO-06 — verificar apenas o link de navegação a partir do hub
