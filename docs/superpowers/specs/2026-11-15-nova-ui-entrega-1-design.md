# Nova UI — Entrega 1: base e tema claro

**Estado:** aguardando aprovação do usuário. **Data:** 2026-11-15.
Direção e sistema visual: [`docs/nova-ui/README.md`](../../nova-ui/README.md).
Evidências dos problemas: [`docs/nova-ui/auditoria.md`](../../nova-ui/auditoria.md).

## Por quê

A Entrega 1 prepara o terreno para o redesenho. Ela conserta cinco bugs que
hoje gravam ou mostram dado errado e troca a base visual do app (cores, fonte,
altura de tela, toque) sem mexer na navegação nem no desenho das telas. As
Entregas 2 a 4 constroem sobre essa base.

## Decisões que este desenho assume

O usuário delegou ao Claude, em 2026-11-15, a resposta das perguntas em aberto
que travavam a entrega. As escolhas estão registradas em "Decisões fechadas" do
README (itens 13 a 16):

| Pergunta                           | Escolha                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Ordem das entregas                 | 1 → 2 → 3 → 4                                                                                 |
| Primeira parcela com o valor total | É bug. O lançamento pai passa a valer a parcela e os parcelamentos já gravados são corrigidos |
| Tema escuro                        | Deixa de existir. O app fica só com o tema claro                                              |
| Fonte                              | Pacote `@fontsource-variable/manrope`, no build do app e no cache offline                     |

## Objetivos

1. Nenhum dos cinco bugs funcionais da auditoria se reproduz.
2. Todas as telas atuais aparecem na paleta clara, com Manrope carregada pelo
   próprio app, inclusive sem rede.
3. Em 390×844: nenhuma tela rola além do conteúdo, a barra inferior respeita a
   área segura do iPhone, nenhum campo dá zoom ao focar e todo alvo de toque
   tem 44px.
4. Nenhum emoji ou símbolo de texto faz papel de ícone.

## Fora do escopo

- Barra de cinco posições, rotas com URL, cabeçalho único e tela Mais (Entrega 2).
  O "+" flutuante continua existindo até lá; aqui ele só deixa de ficar por
  cima dos modais.
- Novo desenho do Extrato, do Lançar e do Início (Entregas 3 e 4).
- Ícones PNG/maskable do PWA e refinamento do desktop (ficam em "Depois"). O
  desktop só não pode quebrar.
- Centavos que sobram da divisão das parcelas (R$ 100,00 em 3x soma R$ 99,99).
  Já era assim e não muda aqui.
- O emoji que o usuário escolhe para cada cofrinho (coluna `cofrinhos.emoji`).
  É dado da família, não ícone do app; fica para o desenho de Cofrinhos.

## O que seria um fracasso

- Texto ilegível em alguma tela depois da troca de tema (contraste abaixo de
  4,5:1).
- Total de um mês fechado mudar sem o snapshot daquele mês ficar marcado como
  divergente.
- A fonte sumir quando o app abre sem rede.
- A migration renomear uma categoria e a família ficar com duas de mesmo nome.

## Abordagens consideradas

| Abordagem                             | Troca                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Um PR com as 14 tarefas               | Um único ciclo de revisão, mas mistura alteração de dado de produção com mudança visual em quase todos os arquivos do `apps/web`          |
| **Dois PRs em sequência (escolhida)** | PR 1 com as correções (pequeno, tem as migrations, reversível sozinho); PR 2 com a base visual (grande, só `apps/web`, sem risco de dado) |
| Um PR por tarefa                      | Revisão mais fácil, mas 14 merges, cada um disparando CI, release e deploy em dev                                                         |

Os dois PRs vão em sequência, não em paralelo: quatro dos cinco bugs estão em
arquivos que a base visual também altera. A troca de tema é global (os tokens
valem para o app inteiro), então precisa entrar e ser validada de uma vez.

Cada tarefa do Checkpoint vira um commit, com teste escrito antes (TDD).

---

## PR 1 — Correções (branch `feat/nova-ui-e1-correcoes`)

### 1. Data padrão do lançamento em horário local

- **Hoje:** `transacao-modal.tsx:45` usa `new Date().toISOString().slice(0, 10)`,
  que é a data em UTC. Depois das 21h o formulário abre com o dia seguinte.
- **Muda:** `apps/web/src/utils/date.ts` ganha uma função que devolve a data
  local em `YYYY-MM-DD`, e o modal passa a usá-la.
- **Teste primeiro:** com o relógio em 14/11 às 23:11 no fuso de São Paulo, a
  função devolve `2026-11-14`. Os testes de data precisam fixar o fuso em
  `America/Sao_Paulo`; com o fuso em UTC (caso do CI) o bug não aparece.

### 2. Primeira parcela com o valor da parcela

- **Hoje:** em `transacao.plano-registro.ts:57` o lançamento pai é a parcela 1
  e fica com `valor` igual ao total; só as filhas recebem `valorParcela`.
  Dashboard, orçamento, fatura e histórico somam `valor`. Uma compra de
  R$ 1.299,90 em 10x pesa R$ 2.469,81 ao longo dos meses.
- **Muda no código:** o pai passa a ter `valor = valorParcela`. `valorTotal`
  continua guardando o total da compra.
- **Muda nos dados:** uma migration corrige os pais já gravados e marca como
  divergentes os snapshots dos meses afetados, como manda a regra de snapshot
  (o snapshot original não é recalculado):

  ```sql
  WITH corrigidas AS (
    UPDATE transacoes
       SET valor = valor_parcela
     WHERE parcelado = true
       AND transacao_pai_id IS NULL
       AND parcela_atual = 1
       AND numero_parcelas > 1
       AND valor_parcela IS NOT NULL
       AND valor = valor_total
    RETURNING familia_id, mes_referencia
  )
  UPDATE snapshots_mensais s
     SET divergente = true
    FROM corrigidas c
   WHERE s.familia_id = c.familia_id
     AND s.mes_referencia = c.mes_referencia;
  ```

  A condição `valor = valor_total` torna a migration segura para rodar de novo
  e deixa de fora um pai cujo valor já tenha sido editado à mão.

- **Teste primeiro:** no service, compra de R$ 300,00 em 3x gera pai com
  `valor` de R$ 100,00 e a soma das três parcelas dá R$ 300,00. A migration
  ganha teste na suíte PostgreSQL (`*.pg.test.ts`): corrige o pai, não toca
  nas filhas nem em pai já editado, e marca o snapshot do mês.
- **Efeito visível:** os totais dos meses em que houve compra parcelada caem
  para o valor correto, inclusive em meses passados.

### 3. "Vigente desde" do orçamento no mês certo

- **Hoje:** `orcamento-page.tsx:173` faz `new Date(vigenciaInicio + '-01')`,
  lido como UTC; em São Paulo volta para o dia 31 do mês anterior.
- **Muda:** a página usa um formatador de `utils/date.ts` que monta a data com
  ano e mês numéricos, como `formatMesLabel` já faz, no formato curto
  ("nov. de 2026").
- **Mesma classe de bug:** `cofrinho-detalhe-page.tsx:198` formata
  `dataFimRecorrencia` com `new Date(...)`. Se o valor vier como
  `YYYY-MM-DD`, entra na mesma correção.
- **Teste primeiro:** orçamento com vigência `2026-11` mostra "nov. de 2026".

### 4. Gráfico de pizza com uma única categoria

- **Hoje:** com 100% em uma fatia, `describeArc` começa e termina no mesmo
  ponto e o SVG não desenha nada.
- **Muda:** fatia que ocupa o círculo inteiro é desenhada como anel completo;
  fatias de valor zero não são desenhadas.
- **Teste primeiro:** com um único item, o gráfico renderiza um anel visível e
  a legenda mostra 100%.

### 5. Acentos nas categorias padrão e nos textos

- **Muda no código:** `categorias-padrao.ts` passa a ter Alimentação, Saúde,
  Educação, Salário e Bônus. `templates-padrao.ts` e `scripts/seed-templates.ts`
  procuram a categoria pelo nome, então mudam junto.
- **Muda nos dados:** uma migration renomeia, nas famílias existentes, as
  categorias com exatamente os nomes antigos, e pula a família que já tiver
  uma categoria com o nome acentuado e o mesmo tipo.
- **Textos do app:** varredura dos textos visíveis do `apps/web` sem acento
  ("Movimentacoes" e similares) e da descrição do manifest.
- **Não muda:** snapshots antigos que guardam nome de categoria continuam com
  o nome da época.
- **Teste primeiro:** família nova recebe as categorias acentuadas e os
  modelos padrão continuam encontrando a categoria; a migration ganha teste na
  suíte PostgreSQL, incluindo o caso da família que já tem "Saúde".

---

## PR 2 — Base visual (branch própria, depois do merge do PR 1)

### 6. Tokens com os valores novos e os tokens adicionais

- `apps/web/src/index.css` recebe os valores da tabela de tokens do README. O
  tema escuro sai; fica um único conjunto em `:root`.
- `tailwind.config.ts` ganha `accent-soft`, `danger-soft`, `warning-soft`,
  `warning-fill`, `border-strong` e `border-soft`.
- O app já usa quase só tokens. O que está fixo e precisa de revisão:
  - `text-white` (41 usos): continua onde o fundo é `success`, `danger` ou
    `info`; cada uso é conferido.
  - `shadow-soft` (20 usos): o nome fica e o valor vira o anel de 1px na cor
    `border`, porque a direção não usa sombra projetada.
  - Cores de gráfico em hexadecimal (`pie-chart`, `mini-chart`, relatórios,
    histórico, dashboard): passam para uma lista única em `components/charts/`,
    com cores legíveis sobre fundo branco, partindo das famílias já definidas
    no README (verde, azul, roxo, âmbar, vermelho).
  - Fundos translúcidos de token (`bg-danger/10` e parecidos): trocados pelos
    tokens `-soft` onde o README define um.
- **Teste primeiro:** um teste lê os tokens de `index.css` e exige contraste
  mínimo de 4,5:1 para `text`, `text-muted` e `text-dim` sobre `bg`, `panel` e
  `surface`, e para branco sobre `success` e `danger`.

### 7. Manrope carregada pelo próprio app

- Dependência nova: `@fontsource-variable/manrope`, importada em `main.tsx`.
  Um arquivo variável cobre os pesos 500 a 800.
- `font-family` em `index.css` e `fontFamily.sans` no Tailwind apontam para a
  família registrada pelo pacote, com `Segoe UI` e `sans-serif` de reserva.
- `workbox.globPatterns` em `vite.config.ts` passa a incluir `woff2`, só com o
  subconjunto latino, para a fonte funcionar offline.
- Números tabulares aplicados no `body`.

### 8. Fundo do `body`, `theme-color` e manifest

- `index.html`: sai o `bg-slate-50` do `body`; `theme-color` vira `#F2F4EF`.
- Manifest em `vite.config.ts`: `theme_color` e `background_color` em
  `#F2F4EF`.

### 9. Altura do shell sem rolagem fantasma

- O shell ocupa a altura visível da tela (`dvh`) e o `<main>` é a única área
  que rola.
- As páginas dentro do shell perdem o `min-h-screen` (17 arquivos); ele soma
  os 68px da barra e cria a rolagem fantasma. Telas fora do shell (login,
  cadastro, onboarding) mantêm a altura mínima de tela.

### 10. Área segura do iPhone

- `viewport-fit=cover` no `index.html`.
- A barra inferior ganha `padding-bottom` de `env(safe-area-inset-bottom)` (a
  classe `pb-safe` usada hoje não existe). O espaço reservado no `<main>`, a
  posição do "+" e o rodapé dos painéis de baixo para cima consideram a mesma
  medida.

### 11. Campos em 16px e alvos de toque com 44px

- Os 43 campos (`input`, `select`, `textarea`) em 13 arquivos repetem a mesma
  lista de classes com `text-sm`. Ela vira uma definição única em
  `components/ui/`, com fonte de 16px, altura mínima de 44px, raio 10 e anel de
  foco de 2px em `success`.
- Alvos pequenos apontados na auditoria (fechar de modal, setas do mês,
  filtros do extrato, "editar/desativar" em categorias) ganham área de 44×44.
- A conferência é por medição no navegador (ver Validação), porque o ambiente
  de teste unitário não calcula tamanho de elemento.

### 12. Escala de z-index

- Quatro níveis nomeados no Tailwind, nesta ordem: barra inferior, "+",
  painel/modal, aviso. Os 13 `z-50` e o `z-40` passam a usar os nomes.
- O "+" fica abaixo de painel/modal, o que resolve o botão por cima dos modais.
- O nível de aviso fica reservado; o aviso em si é da Entrega 3.

### 13. Valores do dashboard sem corte em 390px

- **Hoje:** três cartões lado a lado (`grid-cols-3`); cada um tem 85px para um
  valor que precisa de 108px.
- **Muda:** Saldo em um cartão de largura total e, abaixo, Receitas e Despesas
  em duas colunas. Nenhum valor é truncado.
- É um ajuste mínimo: o Início novo é da Entrega 4.

### 14. Emojis trocados por ícones lucide

- 23 arquivos de `components/` e `pages/` têm emoji ou símbolo de texto
  ("✕", "◀", "▶", "←") como ícone. Cada um vira um ícone de `lucide-react`,
  com `aria-hidden` no ícone e rótulo acessível no botão.
- Uma regra de lint no `apps/web` impede emoji em texto de interface, para o
  problema não voltar.
- Testes unitários (8 arquivos) e E2E (5 specs) que procuram esses símbolos
  são ajustados junto.

---

## Validação

- `pnpm quality` antes de cada commit. Os testes do Web não rodam no CI, então
  o gate local é a única garantia deles.
- Navegador em 390×844 com o `agent-browser`, no ambiente isolado descrito no
  README:
  - **PR 1:** os cinco cenários da auditoria, refeitos (lançar depois das 21h,
    compra em 10x, orçamento criado no mês, pizza com uma categoria, família
    nova com categorias acentuadas).
  - **PR 2:** as 18 telas e os modais (transação, quatro de cofrinho, modelos,
    voz, tour), com captura de cada uma. Em cada tela, um script mede a altura
    da página contra a altura da janela, o tamanho de todo botão, link e campo
    (mínimo de 44px) e a fonte dos campos (mínimo de 16px).
  - Dashboard conferido também em 1280px, para garantir que o desktop não
    quebrou.
- Offline: com o app instalado e a rede desligada, a fonte continua Manrope.

## Riscos

| Risco                                                      | Tratamento                                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A migration das parcelas altera valores em produção        | Só toca pai com `valor = valor_total`; dá para desfazer com `SET valor = valor_total` no mesmo filtro, porque o total fica guardado |
| Totais de meses fechados mudam                             | Esperado; os snapshots desses meses ficam marcados como divergentes                                                                 |
| Tela ou modal não visitado fica com cor ruim no tema claro | Teste de contraste dos tokens e captura de todas as telas e modais                                                                  |
| A API roda migrations ao subir                             | As duas migrations são seguras para rodar mais de uma vez                                                                           |

## O que fica para quem implementa

- Nomes das funções novas em `utils/date.ts` e da definição única de campo.
- Como fixar o fuso nos testes do Web.
- Cores exatas da lista de gráficos, respeitando contraste de 3:1 sobre branco.
- Qual ícone lucide substitui cada emoji.
- A forma da regra de lint contra emoji; se o ESLint do projeto não comportar,
  um teste que varre os arquivos cumpre o mesmo papel.
