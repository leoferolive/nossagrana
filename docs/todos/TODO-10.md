# TODO-10 — Ajuda (FAQ accordion)

**Status:** ⬜ Pendente (revisão de categorias e estilo)

## Objetivo

Alinhar a `AjudaPage` ao wireframe desktop — FAQ accordion com categorias e estilos corretos.

## Arquivo envolvido

- `apps/web/src/pages/ajuda-page.tsx`
- `apps/web/src/pages/ajuda-page.test.tsx`

## Referência: wireframe-desktop.jsx → AjudaScreen

### Estrutura

```
- Título "Ajuda" (24px, bold)
- Subtítulo "Perguntas frequentes sobre o NossaGrana" (13px, muted)
- Seções (cada uma = Card):
  1. Transações
  2. Orçamento
  3. Família
  4. Relatórios
- Dentro de cada Card:
  - CardTitle com nome da categoria
  - Itens de FAQ: linha clicável com pergunta + "›" (rotaciona 90° quando aberto)
  - Resposta expansível: `fontSize 12, lineHeight 1.6, paddingLeft 12, borderLeft 2px primary`
  - Separador border-bottom entre itens (exceto último)
```

### Conteúdo das categorias (baseado no wireframe)

**Transações:**

- "Como cadastrar uma transação?" → instruções para clicar em + Nova Transação e preencher os campos
- "Como funciona o parcelamento?" → cria parcelas automáticas nos meses seguintes
- "O que é uma transação recorrente?" → repete automaticamente até cancelar

**Orçamento:**

- "O que significa o alerta de orçamento?" → amarelo=80%, vermelho=100%
- "Posso mudar o limite no meio do mês?" → sim, vale imediatamente

**Família:**

- "Como convidar alguém para minha família?" → Família > Código de Convite
- "Posso editar transações de outros membros?" → sim, todos os membros podem

**Relatórios:**

- "O que é o snapshot mensal?" → foto dos totais no fim do mês, nunca recalculado
- "O que significa 'Divergente'?" → transações editadas após o snapshot

## Critérios de Aceite

1. 4 categorias renderizadas como Cards: Transações, Orçamento, Família, Relatórios
2. Cada item expande/fecha com animação do "›" (rotate 90°)
3. Resposta com border-left verde e padding correto
4. Separadores entre itens (exceto último de cada seção)
5. Título da página "Ajuda" sem botão "Voltar" quando acessado via sidebar (desktop)
6. Página acessível via sidebar (`onBack` prop opcional)
7. Todos os testes passam; novos FAQs têm cobertura básica

## Notas

- A estrutura de accordion categorizado JÁ EXISTE na `ajuda-page.tsx` — o trabalho é ajustar:
  1. Categorias: de "mês de referência / parcelado / recorrente / snapshot / orçamento / fatura" → para "Transações / Orçamento / Família / Relatórios"
  2. Conteúdo das perguntas para corresponder ao wireframe
  3. Estilos: ícone "›" com rotation, borderLeft 2px na resposta
  4. Botão "Voltar" visível apenas em mobile (via prop `onBack` opcional ou `className="md:hidden"`)
- Não usar `onBack` obrigatório — tornar opcional pois na sidebar desktop não existe contexto de "voltar"
