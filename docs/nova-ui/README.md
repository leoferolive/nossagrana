# Nova UI do NossaGrana

Redesenho mobile-first do frontend (`apps/web`). Este é o arquivo central: guarda a
direção fechada com o usuário e o **checkpoint** do que já foi feito. Toda sessão
retoma o trabalho por aqui.

## Como retomar

1. Leia este arquivo inteiro. Pronto quando você souber dizer qual é a próxima
   tarefa aberta no [Checkpoint](#checkpoint).
2. Trabalhe na entrega em andamento, na ordem das tarefas. Uma entrega só começa
   com um desenho curto aprovado pelo usuário e um plano, ambos em
   `docs/superpowers/` (`specs/` e `plans/`), e o código vai numa branch própria.
3. Antes de construir ou alterar uma tela, leia a seção dela em
   [`telas.md`](telas.md). Ao tocar em um arquivo citado na auditoria, leia
   [`auditoria.md`](auditoria.md).
4. Valide em 390×844 com o `agent-browser`, usando o
   [ambiente isolado](#ambiente-para-validar-no-navegador).
5. Feche a tarefa: marque a caixa no Checkpoint, acrescente uma linha ao
   [Diário](#diário) e registre decisão nova em
   [Decisões fechadas](#decisões-fechadas). Pronto quando a caixa está marcada, o
   diário tem a linha e `pnpm quality` passou.

As decisões desta página mudam só com o aval do usuário. Dúvida que muda o que
será construído vira item em [Perguntas em aberto](#perguntas-em-aberto).

## Checkpoint

**Estado em 2026-11-16:** Entregas 1 e 2 concluídas. Entrega 1: #183 (Correções)
e #186 (Base visual). Entrega 2: #188 (Rotas com URL), #189 (barra de cinco,
Mais, Planejar, cabeçalhos e tour) e o PR dos testes E2E. O miolo de Extrato,
Lançar e Início ainda é o antigo. O desenho da Entrega 3 (Extrato e Lançar) está aprovado e o plano do primeiro PR
dela está escrito. **Próximo passo:** executar o
[plano do PR 1 da Entrega 3 (Correções)](../superpowers/plans/2026-11-16-nova-ui-entrega-3-pr1-correcoes.md)
na branch `feat/nova-ui-e3-correcoes`. Depois, os PRs do Extrato e do Lançar,
cada um com plano próprio.

Cada PR segue este fluxo: um subagente desenvolve, outro testa
e valida, outro revisa e abre o PR; com o review do Codex sem pendências e o CI
verde, o PR é mergeado e vai para dev.

### Descoberta

- [x] 2026-11-14 — Auditoria mobile de 18 das 19 telas (resultado em `auditoria.md`)
- [x] 2026-11-15 — Três propostas visuais comparadas (A, B e C)
- [x] 2026-11-15 — Direção escolhida: estrutura da A com a paleta clara da B
- [x] 2026-11-15 — Rotina mensal da família levantada e regra do lazer confirmada
- [x] 2026-11-15 — Ordem das entregas confirmada: 1 → 2 → 3 → 4 (escolha
      delegada pelo usuário)

### Entrega 1 — Base e tema claro

Sai em dois PRs em sequência: correções (as cinco primeiras tarefas) e base
visual (as demais). Desenho em
[`2026-11-15-nova-ui-entrega-1-design.md`](../superpowers/specs/2026-11-15-nova-ui-entrega-1-design.md).

- [x] 2026-11-15 — Desenho da Entrega 1 aprovado pelo usuário
- [x] 2026-11-15 — Data padrão do lançamento em horário local
- [x] 2026-11-15 — Primeira parcela com o valor da parcela, corrigindo também
      os parcelamentos já gravados
- [x] 2026-11-15 — "Vigente desde" do orçamento no mês certo
- [x] 2026-11-15 — Gráfico de pizza com uma única categoria
- [x] 2026-11-15 — Acentos nas categorias padrão e nos textos
- [x] 2026-11-15 — Tokens com os valores novos e os tokens adicionais
- [x] 2026-11-15 — Manrope carregada pelo próprio app
- [x] 2026-11-15 — Fundo do `body`, `theme-color` e manifest na paleta nova
- [x] 2026-11-15 — Altura do shell sem rolagem fantasma
- [x] 2026-11-15 — Área segura do iPhone na barra inferior
- [x] 2026-11-15 — Campos em 16px e alvos de toque com 44px
- [x] 2026-11-15 — Escala de z-index: barra, "+", painel/modal, aviso
- [x] 2026-11-15 — Valores do dashboard sem corte em 390px
- [x] 2026-11-15 — Emojis trocados por ícones lucide

### Entrega 2 — Navegação

Sai em três PRs em sequência: rotas com URL; barra de cinco, Mais, Planejar,
cabeçalhos e tour; E2E. Desenho em
[`2026-11-16-nova-ui-entrega-2-design.md`](../superpowers/specs/2026-11-16-nova-ui-entrega-2-design.md).

- [x] 2026-11-16 — Desenho da Entrega 2 aprovado pelo usuário
- [x] 2026-11-16 — Rotas com URL (voltar do Android, recarregar mantém a tela, link direto)
- [x] 2026-11-16 — Barra de cinco posições com o "+" dentro
- [x] 2026-11-16 — Cabeçalho único de aba e de passo/detalhe
- [x] 2026-11-16 — Tela Mais
- [x] 2026-11-16 — Planejar como entrada para orçamento, cartões, cofrinhos e contas do mês
- [x] 2026-11-16 — Um único tour de boas-vindas
- [x] 2026-11-16 — E2E ajustados à nova navegação (29 passam, 3 em `test.fixme`
      por defeitos do app; como rodar em `apps/e2e/README.md`)

### Entrega 3 — Extrato e Lançar

Sai em três PRs em sequência: correções, Extrato e Lançar. Desenho em
[`2026-11-16-nova-ui-entrega-3-design.md`](../superpowers/specs/2026-11-16-nova-ui-entrega-3-design.md).

- [x] 2026-11-16 — Desenho da Entrega 3 aprovado pelo usuário
- [x] 2026-11-16 — Correções: limite duplicado, membros que não recarregam e erro 500 no
      limite de login
- [ ] Extrato em ordem cronológica, agrupado por dia, com total do dia
- [ ] Lista do Extrato atualizada logo depois de salvar ou excluir um lançamento
      (hoje só atualiza ao sair e voltar à tela; visto na validação do #188)
- [ ] Resumo do período, filtros e busca
- [ ] Lançar com valor primeiro e chips de categoria, data e pagamento
- [ ] Salvar fixo no rodapé e "Mais opções" para descrição, parcelas e repetição
- [ ] Botão de voz visível
- [ ] Aviso "lançado" com desfazer e confirmação própria de exclusão

### Entrega 4 — Plano do mês e Início

- [ ] Backend: direito de lazer por membro
- [ ] Backend: de quem é cada gasto de lazer
- [ ] Planejar com os quatro passos e a sobra do plano
- [ ] Passos 1 a 3 sobre os modelos de lançamento existentes
- [ ] Passo 4: lazer de cada um
- [ ] Início: saldo, régua do mês, plano, aviso e últimos lançamentos
- [ ] Lançar: "Lazer de quem" e aviso do mês em que desconta

### Depois (sem data)

Telas ainda sem desenho (lista em `telas.md`), desktop, Análises (Relatórios +
Histórico em uma tela) e ícones PNG/maskable do PWA.

Achado na revisão do PR 1, sem relação com a interface: quando a divisão das
parcelas não é exata, a soma fica centavos abaixo do total (R$ 100,00 em 3x soma
R$ 99,99). A sobra deveria ir para a parcela 1.

Defeito do app achado ao ajustar os testes E2E (PR 3 da Entrega 2), ainda sem
correção:

- A API não tem rota para excluir a conta (`DELETE /auth/account`), que os
  testes E2E tentavam usar para limpar os usuários criados.

Pontos menores que ficaram do PR 2 da Entrega 2 (validação no navegador):

- O detalhe do cofrinho fica a três toques da barra (Planejar › Cofrinhos ›
  cofrinho).
- O seletor de família (`/familias`) não tem botão de voltar.
- No desktop em 1280×800, Perfil e Ajuda ficam abaixo da dobra do menu lateral.
- No Extrato, "Exportar CSV" ocupa uma linha própria.
- Em Planejar, "Contas do mês" mostra só a quantidade de modelos: o app não
  registra qual modelo já foi lançado no mês. A linha da fatura mostra os dias
  de fechamento e vencimento cadastrados, sem calcular a data.

Pontos menores que ficaram da Entrega 1 (revisão e validação do PR 2):

- Escape não fecha os modais de cofrinho.
- O mesmo orçamento aparece como 6% no dashboard e 7% na tela de orçamento
  (arredondamentos diferentes).
- Botão desabilitado com texto branco tem contraste entre 2,7:1 e 3,5:1.
- No modal de modelos, os ícones de editar e excluir ficaram afastados da borda
  direita.
- Nas telas de login, cadastro e onboarding, um elemento decorativo deixa o
  `<main>` 40px mais largo que a tela (sem rolagem visível).
- O campo de data nativo mede 48px, e não 44px.
- A área segura só é tratada embaixo; em paisagem, num iPhone com notch, a
  borda lateral pode ficar atrás dele.
- O desktop só foi validado no dashboard, em 1280px.
- A regra de lint contra símbolos reprova "×" usado como multiplicação e não
  pega `{'+ Texto'}` escrito como expressão.
- Os testes de `cores-saida.test.ts` conferem o texto dos arquivos, não a tela.

### Diário

- 2026-11-15 — Arquivo criado com a direção aprovada. Nada implementado.
- 2026-11-15 — O usuário delegou as respostas das perguntas em aberto; ordem das
  entregas, tema, primeira parcela e fonte decididas (decisões 13 a 16). Desenho
  da Entrega 1 escrito, aguardando aprovação.
- 2026-11-15 — Desenho da Entrega 1 aprovado pelo usuário. Plano do PR 1
  (Correções) escrito.
- 2026-11-15 — Data padrão do lançamento passa a usar o dia local
  (`getTodayLocalISO`); os testes do Web rodam com o fuso fixo em São Paulo.
- 2026-11-15 — O pai de um parcelamento passa a valer a parcela; a migration
  `0013_parcela_pai_valor` corrige os já gravados e marca como divergentes os
  snapshots dos meses afetados.
- 2026-11-15 — "Vigente desde" do orçamento e a data fim do aporte recorrente
  do cofrinho deixam de voltar um dia por causa do fuso (`formatMesCurto`,
  `formatDataBR`).
- 2026-11-15 — Gráfico de pizza desenha o anel completo quando há uma única
  categoria e deixa de listar categorias zeradas.
- 2026-11-15 — Categorias padrão com acento (seed e migration
  `0014_categorias_padrao_acentos` para as famílias existentes) e textos de
  cofrinho e onboarding acentuados.
- 2026-11-15 — PR 1 validado no navegador em 390×844 (dashboard, orçamento,
  categorias, cofrinho, extrato e formulário de lançamento). Os specs E2E de
  onboarding, família e transações não serviram de validação: já estão
  desatualizados na `main` (esperam o texto "Como deseja entrar", que não existe
  mais no app, e usam `selectOption` num seletor que deixou de ser `<select>`).
  O acerto fica para a tarefa "E2E ajustados à nova navegação" da Entrega 2.
- 2026-11-15 — PR 1 (#183) revisado por subagente e pelo Codex, sem pendências,
  e mergeado. Plano do PR 2 (Base visual) escrito.
- 2026-11-15 — Paleta clara aplicada nos tokens (tema escuro removido), seis tokens novos (`accent-soft`, `danger-soft`, `warning-soft`, `warning-fill`, `border-strong`, `border-soft`), `shadow-soft` vira anel de 1px e as cores de gráfico passam para `chart-colors.ts`; teste de contraste dos tokens.
- 2026-11-15 — Manrope vem do pacote `@fontsource-variable/manrope` (importada em `main.tsx`), com números tabulares no `body`; só o subconjunto latino entra no precache do service worker (conferido no build: `sw.js` lista o `woff2`).
- 2026-11-15 — `<body>` sem o fundo slate, `theme-color` e manifest em `#F2F4EF`, `viewport-fit=cover`.
- 2026-11-15 — `pb-safe` passa a existir (`spacing.safe`); o `<main>`, o "+" e o rodapé dos painéis de baixo para cima somam `env(safe-area-inset-bottom)`.
- 2026-11-15 — `AppShell` em `h-dvh` com `overflow-hidden` (o `<main>` é a única área que rola); páginas do shell trocam `min-h-screen` por `min-h-full` e as telas de autenticação usam `min-h-dvh`.
- 2026-11-15 — `CAMPO_CLASSES` (16px, 44px de altura, raio 10, anel de foco em `success`) vira a definição única dos 43 campos e do `CustomSelect`; `ALVO_TOQUE_CLASSES` dá 44x44 a fechar de modal, setas do mês, filtros do extrato e editar/desativar em categorias. Medição no navegador fica para a validação.
- 2026-11-15 — Escala nomeada de z-index no Tailwind (`z-barra` 40, `z-lancar` 45, `z-painel` 50, `z-aviso` 60, este só reservado); o "+" passa a ficar abaixo de modais e painéis.
- 2026-11-15 — Dashboard com Saldo em cartão de largura total e Receitas/Despesas em duas colunas abaixo (`grid-cols-2`; no desktop volta a três colunas na ordem antiga); valores com `tabular-nums` e sem `truncate`.
- 2026-11-15 — Emojis e símbolos de texto (✕ ◀ ▶ ← → ↑ ↓ ⚠) viram ícones de `lucide-react` com `aria-hidden`, e o botão que era só símbolo mantém nome acessível; o tour passa a receber ícones; regra `no-restricted-syntax` no ESLint (`eslint.config.mjs`) barra emoji e esses símbolos em texto de interface; o emoji escolhido pelo usuário no cofrinho segue como está.
- 2026-11-16 — Rodada de correção do PR 2 após validação no navegador: regra base de 44px para botão, aba, select e rádio; "+" não cobre mais o fim da rolagem; saída em texto neutro e verde como única cor de ação; o "+" de texto dos botões virou ícone `Plus` (a regra de lint também barra isso).
- 2026-11-16 — Ajustes da revisão do PR 2: selo de variação do dashboard com nome acessível ("subiu/caiu N%"), campo desabilitado e `py-2.5` em `CAMPO_CLASSES`, mês em "Novembro de 2026" e alvo de toque nas setas de Lançamentos, `bg-info/10` no `auth-shell`.
- 2026-11-16 — Campos com 44px de altura (`py-2` em `CAMPO_CLASSES`). PR 2 (#186)
  validado em duas rodadas no navegador (todas as telas e modais em 390×844),
  revisado por subagente e pelo Codex, sem pendências. Entrega 1 concluída.
- 2026-11-16 — PR 2 (#186) mergeado. Desenho da Entrega 2 (Navegação) escrito,
  aguardando aprovação do usuário.
- 2026-11-16 — Desenho da Entrega 2 aprovado pelo usuário (decisões 17 a 23).
  Plano do PR 1 da entrega (Rotas com URL) escrito.
- 2026-11-16 — Entrega 2, PR 1: entra o mapa de endereços das telas em `apps/web/src/routes/caminhos.ts`, com a tradução nos dois sentidos entre os identificadores de tela de hoje e o endereço.
- 2026-11-16 — Entrega 2, PR 1: entra o `react-router` 7 (modo declarativo) e a tela passa a vir do endereço. O `App.tsx` (454 linhas) vira uma casca de 8 linhas; a árvore de rotas fica em `apps/web/src/routes/` e o fluxo de sessão, o lançar e a voz em hooks. As páginas e o `AppShell` seguem com as mesmas propriedades de navegação. Os quatro testes do `App` passam a usar `renderApp` (roteador em memória) com os mesmos cenários.
- 2026-11-16 — Entrega 2, PR 1: guardas de rota (`routes/guardas.tsx`). Sem login, endereço protegido leva a `/entrar` guardando o endereço pedido no `state` da entrada de histórico; depois do login o app volta a ele (só endereço interno: `//` e `/\` são descartados). Sair substitui a entrada do histórico e não deixa a tela deixada como endereço pedido.
- 2026-11-16 — Entrega 2, PR 1: cofrinho e fatura passam a ser identificados pelo endereço (`useParams`/`useSearchParams`); `mes` fora de AAAA-MM vale como ausente (mês corrente) e o nome do cartão vem da store de métodos (`useNomeDoMetodo`). O detalhe do cofrinho ganhou estado de erro e não mostra mais o detalhe guardado de outro cofrinho. Trocar de família num endereço com id leva ao Início.
- 2026-11-16 — Entrega 2, PR 1: o painel de lançar passa a viver no endereço (`?lancar=nova` ou `?lancar=<id>`, hook `usePainelLancar`). Abrir acrescenta um passo ao histórico, então o voltar do navegador fecha só o painel e a tela de baixo não muda; fechar pelo botão desfaz esse passo; link direto ou recarga só removem o parâmetro. Transação em edição que não está em memória (recarga) fecha o painel em vez de abrir vazio.
- 2026-11-16 — Entrega 2, PR 1: `navigateFallbackDenylist` no service worker deixa `/api/` e `/health` fora do retorno de navegação para `index.html` (conferido no build: `dist/sw.js` registra `NavigationRoute` com `denylist:[/^\/api\//,/^\/health/]`). Rotas com URL fechadas; falta a validação no navegador.
- 2026-11-16 — Entrega 2, PR 1, correções após a validação no navegador: o "Voltar" da tela volta uma entrada do histórico (`voltarPara` em `use-navegacao.ts`) e só vai à origem do mapa, substituindo a entrada, quando a tela foi aberta por link direto; recarregar com `?lancar=<id>` desconhecido só remove o parâmetro, sem andar no histórico (idempotente no StrictMode); fatura com erro não mostra o estado vazio.
- 2026-11-16 — Entrega 2, PR 1, segunda correção: depois do login (e em toda guarda) o app vai ao destino substituindo a entrada, para a tela de login não ficar atrás da tela pedida; o "Voltar" da tela decide pela posição no histórico (`idx` do `window.history.state`, em `routes/historico-do-app.ts`) e não pela `key`, que `replace` troca; recarregar com `?lancar=<id>` desconhecido volta uma entrada (uma vez por entrada) em vez de deixar duas telas iguais seguidas.
- 2026-11-16 — Entrega 2, PR 1, correções da revisão de código: encerrar o painel de lançar (X, salvar, excluir, envio que termina, toque duplo) anda no histórico uma só vez por abertura; `usePainelLancar` e a área logada em funções menores; a escolha de família limpa a store de métodos de pagamento, e entradas de cofrinho/fatura guardam a família em que foram abertas (`state.familiaId`), então voltar do navegador a uma delas, já em outra família, vai ao Início.
- 2026-11-16 — Entrega 2, PR 1: `limparDadosDaFamilia` (`stores/limpar-dados-da-familia.ts`) zera as stores globais com dado de família (categorias, cofrinhos, dashboard, métodos, modelos e transações) na escolha de família, ao sair e ao entrar; sessão e websocket ficam de fora. Antes o Início mostrava o cofrinho da família ou conta anterior até a nova resposta chegar.
- 2026-11-16 — Entrega 2, PR 1, achado do Codex: o rascunho de voz agora é descartado sempre que o painel de lançar passa a fechado (inclusive pelo voltar do histórico), e não só nos callbacks do modal; antes ele sobrescrevia o lançamento seguinte.
- 2026-11-16 — PR 1 da Entrega 2 (#188) mergeado. Plano do PR 2 (barra de cinco,
  Mais, Planejar, cabeçalhos e tour) escrito.
- 2026-11-16 — Entrega 2, PR 2, barra de cinco: `BottomNav` com Início, Extrato, "+", Planejar e Mais (links; `abaDoCaminho` marca a aba também em telas de segundo nível), "+" de 58px dentro da barra em `z-lancar`; o botão flutuante saiu do `AppShell` e o toque longo para voz virou o hook `useToqueLongo`, que agora também solta a marca do toque longo se o dedo sai do botão sem clique (antes o próximo toque era engolido). Reserva do `<main>` passou a 112px mais a área segura.
- 2026-11-16 — Entrega 2, PR 2, cabeçalhos únicos: `CabecalhoAba` (Início, Extrato; título 26/800 que some no desktop, pílula de mês à direita) e `CabecalhoDetalhe` (voltar 44×44 por `voltarPara(origem)`, título 20/800, subtítulo e ação opcionais) substituem os cabeçalhos próprios; `MonthNav` virou a pílula de mês. As páginas deixam de receber `onBack`/`onNavigate`/`onVerDetalhe`/`onVerFatura` e falam com o roteador por `useNavegacao`. `FamilySettingsPage` perdeu o ramo `AuthShell` (a única rota que a monta é `/mais/familia`, sempre dentro da casca). Em Relatórios e Lançamentos do mês a pílula fica numa linha abaixo do cabeçalho, porque no celular não cabe ao lado do título. Início passa a se chamar "Início" no cabeçalho (era "NossaGrana"). Testes de página usam `renderPagina` (`src/test/render-pagina.tsx`).
- 2026-11-16 — Entrega 2, PR 2, tela Mais: `MaisPage` (Análises, Família, Cadastros, Conta, com Sair em `danger`) no lugar de `ConfiguracoesPage`, que foi apagada. Os grupos vivem em `components/grupos-de-mais.ts` e o menu lateral do desktop lê a mesma lista, mais um grupo Planejar (Contas do mês, Limites por categoria, Cofrinhos); o menu e o `AppShell` deixaram de receber `currentScreen`/`onNavigate` (itens viraram links, marcados pelo endereço). Id de tela `configuracoes` virou `mais` e entrou `planejar` em `caminhos.ts`.
- 2026-11-16 — Entrega 2, PR 2, tela Planejar: `PlanejarPage` com Contas do mês, Limites por categoria, uma linha de fatura por cartão de crédito ativo e Cofrinhos; o redirecionamento de `/planejar` para as contas saiu. Resumos por `usePlanejar`, sem chamada nova à API: contas "lançadas" são os modelos cujo nome aparece como descrição de transação do mês (é como a API grava o que "Salvar Lançamentos" cria; não existe marca persistida), limites "estourados" vêm de `getDashboardOrcamento` do mês, o vencimento sai de `vencimentoDaFatura` (vencimento no dia do fechamento ou antes cai no mês seguinte) e cofrinhos "ativos" de `cofrinhoService.listar`. Falha de um resumo deixa só aquela linha sem resumo e mostra um aviso; as linhas navegam sempre.
- 2026-11-16 — Entrega 2, PR 2, tour único: `TourBoasVindas` (quatro passos: Início, Lançar, Planejar, Mais) montado só no Início, com a chave nova `tour-boas-vindas` (`utils/tour.ts`); quem só tem as marcas dos oito tours antigos vê o novo uma vez. Os tours de Extrato, Relatórios, Orçamento, Histórico, Cofrinhos e Perfil saíram (o de Configurações foi junto com a página), e "Rever tutorial", em Ajuda, apaga a marca nova e leva ao Início. Um teste de guarda (`sem-tour-por-tela.test.ts`) impede que outra página volte a montar tour.
- 2026-11-16 — Entrega 2, PR 2, ajuste em Planejar: saíram duas regras que eu tinha inventado. A fatura mostra os dias cadastrados no cartão ("fecha dia X · vence dia Y", só o que existir; `vencimentoDaFatura` foi apagada, a conversão em data é decisão da Entrega 4) e Contas do mês mostra só "M contas no mês", porque a tela Lançamentos do mês não calcula quais modelos já foram lançados (casar transação com modelo pelo nome não é confiável).
- 2026-11-16 — Entrega 2, PR 2, correções da validação no navegador: o "+" agora sobe 28px acima da barra (a coluna dele estava sem altura e o `-top-7` contava a partir do meio da barra; ganhou `self-stretch`); `CabecalhoDetalhe` não corta mais o título (quebra em duas linhas) e Cartões e Pagamentos virou "Métodos de pagamento"; se a lista de famílias falha, quem tem família ativa fica no seletor com aviso (antes ia ao onboarding), e o seletor marca a família "Atual"; Planejar não mostra "0 de 0" em mês sem orçamento e mantém o título da linha em uma linha, com o resumo descendo quando não couber.
- 2026-11-16 — Entrega 2, PR 2, correções da revisão de código: a área logada passou a carimbar a família em toda entrada de histórico com id (fatura aberta por Planejar escapava; os chamadores deixaram de passar `state`), com `semEntradaAnterior` no state para o Voltar de link direto; o aviso de falha da lista de famílias some ao tentar de novo; títulos alinhados à navegação ("Contas do mês", "Limites por categoria") e a Ajuda descreve o "+" da barra; no desktop o título da aba fica na TopBar e o de detalhe no próprio cabeçalho (a TopBar não o repete), e o menu lateral ganhou o link Planejar; nome de cartão comprido quebra linha em Planejar.
- 2026-11-16 — Entrega 2, PR 3: os seis specs do E2E rodam na navegação nova, em 390×844, e a suíte cabe no limite de requisições da API (um login por teste, janela deslizante gravada em arquivo, cerca de 10 minutos, 30 cadastros e 32 logins por execução). Passam 29; três ficam em `test.fixme`, um por defeito do app: o Extrato não atualiza a lista depois de salvar na própria tela (Entrega 3), editar o limite de uma categoria na mesma vigência duplica a categoria na lista de limites e aprovar uma solicitação de entrada não mostra o novo membro sem recarregar. Também anotado: a API não tem rota de exclusão de conta.
- 2026-11-16 — Entrega 3, PR 1, limite de categoria: editar o limite na mesma vigência atualiza a linha existente em vez de encerrar e inserir outra (`atualizarValor` no repositório); em vigência nova o limite anterior continua sendo encerrado e o histórico mostra os dois. A migration `0015_orcamento_vigencia_unica` move as duplicatas exatas já gravadas (mesma família, categoria e `vigencia_inicio`) para `orcamento_categoria_duplicados`, mantendo a mais recente, e cria o índice único `orcamento_categoria_vigencia_uq`; limites de outros meses não são tocados. Uma violação do índice (corrida entre duas requisições) refaz a gravação uma vez, atualizando a linha que a outra criou; vigência já encerrada responde 409 `LIMITE_VIGENCIA_DUPLICADA`. Teste na suíte PostgreSQL.
- 2026-11-16 — Entrega 3, PR 1, tela da família: aprovar uma solicitação recarrega a lista de membros (o novo membro aparece sem recarregar a página); se a recarga falhar, a tela mostra o erro e mantém a lista anterior. Rejeitar só tira a solicitação dos pendentes e não busca os membros de novo.
- 2026-11-16 — Entrega 3, PR 1, limite de requisições: estourar o limite (por exemplo, o do login) devolve 429 com `{ error: { message: "Muitas tentativas. Tente novamente em N segundos.", code: "LIMITE_REQUISICOES" } }` e o cabeçalho `retry-after`, em vez de 500. O `@fastify/rate-limit` 10.3.0 lança o que o `errorResponseBuilder` devolve; ele agora devolve um `ErroComEnvelopeHttp` (`LimiteRequisicoesError`), que o handler central já serializa. `buildApp` ganhou a opção `limiteDeRequisicoes` para os testes ligarem o limite.
- 2026-11-16 — Entrega 3, PR 1, testes E2E: os specs `orcamento` e `familia` rodam sem `test.fixme` (limite sem duplicar e membro novo sem recarregar); a suíte passa a ter 31 testes rodando e 1 em `test.fixme` (o Extrato, da Entrega 3 PR 2).
- 2026-11-16 — Entrega 3, PR 1, ajustes da revisão: pedir um limite com início anterior ao do limite vigente responde 409 `LIMITE_VIGENCIA_ANTERIOR` (mês pedido e início vigente na mensagem) antes de qualquer escrita, em vez de encerrar o vigente e criar uma segunda linha válida no mesmo mês; a leitura do erro do PostgreSQL embrulhado pelo Drizzle (`cause`) virou `encontrarErroPostgres`, em `shared/postgres/`, usada pela tradução de FK composta e pelo índice de vigência.

## Decisões fechadas

| #   | Decisão                                                                                                                                                                | Por quê                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Celular primeiro, tela de referência 390×844                                                                                                                           | É onde a família lança e consulta                                                                                                                                                                                                                     |
| 2   | Estrutura "Mês em foco": um número principal por tela, régua do mês, cartões                                                                                           | Proposta A, escolhida pelo usuário                                                                                                                                                                                                                    |
| 3   | Paleta clara: papel esverdeado, tinta verde-escura, um acento verde                                                                                                    | Paleta da proposta B, escolhida pelo usuário                                                                                                                                                                                                          |
| 4   | Fonte Manrope em tudo, com números tabulares                                                                                                                           | Já é a fonte declarada no app; hoje ela nunca é carregada                                                                                                                                                                                             |
| 5   | Barra inferior: Início · Extrato · + · Planejar · Mais                                                                                                                 | O "+" flutuante cobria valores e modais                                                                                                                                                                                                               |
| 6   | Toda tela tem URL                                                                                                                                                      | Hoje o voltar do Android sai do app e recarregar cai no dashboard                                                                                                                                                                                     |
| 7   | Planejar é o **plano do mês** em quatro passos: receitas, contas fixas, cofrinhos, lazer de cada um                                                                    | É a ordem em que a família preenche a planilha                                                                                                                                                                                                        |
| 8   | Lazer disponível = direito fixo da pessoa − lazer dela no cartão, na fatura que vence no mês                                                                           | Regra da planilha, confirmada pelo usuário                                                                                                                                                                                                            |
| 9   | Verde é a única cor de ação; vermelho só para alerta; saída em texto neutro, entrada em verde                                                                          | Na auditoria, verde, azul, laranja e vermelho disputavam a ação principal                                                                                                                                                                             |
| 10  | Os nomes dos tokens Tailwind ficam (`bg-bg`, `bg-panel`, `text-text-muted`…); mudam os valores                                                                         | `.claude/rules/code-style.md` já os define; evita renomear o app inteiro                                                                                                                                                                              |
| 11  | Ícones só de `lucide-react`; nenhum emoji na interface                                                                                                                 | Regra do projeto de uma biblioteca de ícones                                                                                                                                                                                                          |
| 12  | Alvos de toque com 44px, campos em 16px, texto com contraste mínimo de 4,5:1                                                                                           | Campos em 14px dão zoom no iPhone; botão verde com texto branco tinha 2,3:1                                                                                                                                                                           |
| 13  | Ordem das entregas: 1 → 2 → 3 → 4                                                                                                                                      | Planejar é uma aba da barra nova e seus passos têm URL, então a 4 depende da 2                                                                                                                                                                        |
| 14  | Só o tema claro; o tema escuro deixa de existir                                                                                                                        | O app nunca teve alternador; os tokens são variáveis CSS, dá para voltar depois                                                                                                                                                                       |
| 15  | Primeira parcela com o valor total é bug: o pai passa a valer a parcela e os já gravados são corrigidos, com os snapshots dos meses afetados marcados como divergentes | Os totais somam `valor`; R$ 1.299,90 em 10x pesava R$ 2.469,81                                                                                                                                                                                        |
| 16  | Manrope pelo pacote `@fontsource-variable/manrope`, no build do app e no cache offline                                                                                 | O app é um PWA e a fonte precisa funcionar sem rede                                                                                                                                                                                                   |
| 17  | Rotas com `react-router` 7, no modo declarativo                                                                                                                        | Padrão de fato, com rotas aninhadas e parâmetros prontos; o servidor já devolve o `index.html` para qualquer endereço. Ficamos na versão 7, que segue mantida: a 8 (de 2026-06) exige Node 22.22 ou mais novo, e a imagem de build do Web usa Node 20 |
| 18  | Endereços em português, agrupados pela aba (`/extrato`, `/planejar/cofrinhos`, `/mais/categorias`)                                                                     | O endereço diz onde a tela fica na navegação                                                                                                                                                                                                          |
| 19  | Abrir o painel de lançar acrescenta um passo ao histórico                                                                                                              | O voltar do Android fecha o painel em vez de sair da tela                                                                                                                                                                                             |
| 20  | A barra inferior aparece nas quatro abas e nas telas de segundo nível, com a aba de origem marcada                                                                     | Trocar de aba não exige voltar antes                                                                                                                                                                                                                  |
| 21  | Um único tour de boas-vindas, mostrado uma vez a todos                                                                                                                 | Eram oito tours, um por tela; a navegação mudou para todo mundo                                                                                                                                                                                       |
| 22  | O mês selecionado não vai para o endereço; só a fatura leva o mês                                                                                                      | O mês identifica a fatura; nas outras telas seria custo sem ganho agora                                                                                                                                                                               |
| 23  | Troca de família em Mais › Família; a troca rápida no topo do Início vem com o Início novo (Entrega 4)                                                                 | O topo do Início é redesenhado na Entrega 4                                                                                                                                                                                                           |
| 24  | Extrato do mais recente para o mais antigo, agrupado por dia, com o total do dia                                                                                       | É como a família confere o mês; hoje a lista vem na ordem de criação                                                                                                                                                                                  |
| 25  | "Mais usadas" no Lançar: as seis categorias com mais lançamentos nos últimos 60 dias, calculadas no app                                                                | Não muda a API; família nova vê as seis primeiras categorias padrão                                                                                                                                                                                   |
| 26  | Aviso "lançado" com "Desfazer" por 6 segundos; exclusão confirmada num painel do app                                                                                   | Hoje nada avisa que salvou, e a exclusão usa a confirmação nativa do navegador                                                                                                                                                                        |
| 27  | Microfone visível ao lado do valor, além do toque longo no "+"                                                                                                         | O toque longo ninguém descobre sozinho                                                                                                                                                                                                                |
| 28  | "Lazer de quem" fica para a Entrega 4                                                                                                                                  | Depende do direito de lazer por pessoa, que é backend da Entrega 4                                                                                                                                                                                    |

As decisões 13 a 16 foram escolhidas pelo Claude em 2026-11-15, por delegação do
usuário. As decisões 17 a 23 foram propostas pelo Claude no desenho da Entrega 2,
que o usuário aprovou em 2026-11-16. As decisões 24 a 28 vieram do desenho da Entrega 3,
aprovado no mesmo dia.

`docs/AUDIT-UX.md` (2026-03) e `docs/wireframes/` são anteriores a esta direção;
onde divergirem, vale este arquivo.

## Sistema visual

### Tokens

Valores de partida para `apps/web/src/index.css` (formato `R G B`). Confira o
contraste ao aplicar.

| Token            | Valor     | RGB           | Uso                                         |
| ---------------- | --------- | ------------- | ------------------------------------------- |
| `bg`             | `#F2F4EF` | `242 244 239` | Fundo do app                                |
| `panel`          | `#FFFFFF` | `255 255 255` | Cartões, painéis, barra inferior            |
| `sidebar`        | `#F2F4EF` | `242 244 239` | Menu lateral do desktop, igual ao fundo     |
| `surface`        | `#ECEFE9` | `236 239 233` | Campos e trilhos de barra                   |
| `surface-hover`  | `#E2E6DE` | `226 230 222` | Hover e pressionado                         |
| `card-alt`       | `#F8F9F6` | `248 249 246` | Cartão secundário                           |
| `border`         | `#D9DED6` | `217 222 214` | Anel de cartão e divisórias                 |
| `text`           | `#17211C` | `23 33 28`    | Texto principal                             |
| `text-muted`     | `#45524A` | `69 82 74`    | Texto de apoio                              |
| `text-dim`       | `#5A675F` | `90 103 95`   | Rótulos e metadados (5,3:1 sobre o fundo)   |
| `success`        | `#0F6B3E` | `15 107 62`   | Ação principal, entradas, passo pronto      |
| `success-strong` | `#0B5330` | `11 83 48`    | Pressionado                                 |
| `primary`        | `#0F6B3E` | `15 107 62`   | Passa a ser o mesmo verde (antes era azul)  |
| `danger`         | `#B3261E` | `179 38 30`   | Alerta e exclusão                           |
| `warning`        | `#8A5A00` | `138 90 0`    | Texto de atenção                            |
| `info`           | `#1F5F8B` | `31 95 139`   | Marcação neutra (dia de fechamento, cartão) |

Tokens a criar: `accent-soft` `#DDEBE2` (linha do passo em andamento, avatar),
`danger-soft` `#F7E1DE` (fundo de aviso), `warning-soft` `#F6ECCD`, `warning-fill`
`#C98A00` (preenchimento de barra), `border-strong` `#C9D0C8` (anel de campo e
chip), `border-soft` `#E6EAE3` (divisória dentro de cartão). Texto sobre `success`
é branco.

Ícone de categoria: quadrado com fundo claro e tinta escura da mesma família.
Definidos: outros `#E6E9E3`/`#45524A`, compras `#E1ECF5`/`#1F5F8B`, lazer
`#ECE6F6`/`#5B3FA6`, alimentação `#F6ECCD`/`#8A5A00`, saúde `#F7E1DE`/`#B3261E`.
As demais seguem o mesmo padrão.

### Tipografia, espaço e profundidade

- **Escala:** 11 (rótulo da barra), 12 (metadado), 13, 14 (chip, apoio), 15
  (corpo), 16 (botão, campo), 20 (título de passo), 26 (título de aba), 46 (número
  principal). Pesos 500, 600, 700 e 800. Títulos com `letter-spacing` de −0,02em;
  número principal com −0,035em.
- **Números:** `tabular-nums` em todo valor.
- **Espaço:** base de 4px. Margem lateral de 20px para conteúdo solto e 14px para
  cartões.
- **Raio:** 10 campo, 12–14 linha e aviso, 16 botão, 18 cartão, 28 topo do painel,
  999 chip e pílula.
- **Profundidade:** troca de superfície mais anel de 1px (`box-shadow: 0 0 0 1px`
  na cor `border`). Sem sombra projetada.

### Componentes

| Componente                | Medidas                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barra inferior            | 84px mais a área segura; fundo `panel`, linha superior `border`; 5 colunas; aba com ícone 24 e rótulo 11px (ativa 700 `success`, inativa 600 `text-dim`)                                                       |
| "+" central               | Círculo de 58px, fundo `success`, ícone branco de 28px, 28px acima da barra, anel de 6px na cor `bg`                                                                                                           |
| Cabeçalho de aba          | Título 26/800 à esquerda; pílula de mês à direita                                                                                                                                                              |
| Pílula de mês             | Dois botões de 44×44 com seta e o mês em 14/700; fundo `panel`, anel `border`, raio 999                                                                                                                        |
| Cabeçalho de passo        | Voltar 44×44, título 20/800, "Passo N de 4" em 13/600 `text-dim`; abaixo, 4 segmentos de 4px: `success` pronto, `text` atual, `border-strong` pendente                                                         |
| Número principal          | 46/800, um por tela, com rótulo de 13/600 `text-dim` acima e uma linha de apoio de 14/600 abaixo                                                                                                               |
| Cartão                    | Fundo `panel`, anel `border`, raio 18, padding de 14 a 16                                                                                                                                                      |
| Passo do plano            | Linha de 48 a 56px; marcador de 26px: círculo `success` com check (pronto), anel de 2px `success` com o número (em andamento), anel de 2px cinza com o número (pendente); passo em andamento com `accent-soft` |
| Linha de lançamento       | Mínimo de 52px; ícone de categoria 38×38 raio 12; título 15/600 com reticências; metadado 12px `text-dim`; valor 15/700 à direita                                                                              |
| Cabeçalho de dia          | 34px; 12/700 em caixa alta, `text-dim`; total do dia à direita                                                                                                                                                 |
| Chip                      | Altura 44, padding 0 12–14, 14/600, anel `border-strong`; selecionado: fundo `success`, texto branco 700                                                                                                       |
| Botão primário            | Altura 56 (54 em rodapé com resumo), raio 16, fundo `success`, texto branco 16/800                                                                                                                             |
| Campo de valor em lista   | 124×44, raio 10, 16/700 alinhado à direita; vazio: fundo `bg`, anel `border-strong`; em foco: fundo `panel`, anel de 2px `success`                                                                             |
| Valor do lançamento       | Campo de 56/800 sem borda, altura 64, prefixo "R$" em 22/700 `text-dim`; microfone circular de 52px ao lado                                                                                                    |
| Painel de baixo para cima | Raio 28 no topo, padding 10/20, alça de 40×4, rodapé fixo com o botão                                                                                                                                          |
| Aviso                     | Altura 48, raio 14, fundo `danger-soft`, texto `danger` 14/700, ícone à esquerda e seta à direita                                                                                                              |
| Rodapé de passo           | Fundo `panel`, linha superior `border`; resumo à esquerda (rótulo 12px, valor 18/800) e botão primário à direita                                                                                               |

**Régua do mês** (assinatura do produto, fica no Início): barra de 8px mostrando
quanto da renda já saiu (trilho `#E0E5DD`, preenchimento `warning-fill`) e, logo
abaixo, 30 marcas, uma por dia, com 3px de intervalo e 8px de altura. Dias
passados `#93A097`, futuros `#D5DBD2`, hoje `success` com 14px, dia de fechamento
do cartão `info` com 11px. Legenda em 12/600. A comparação entre a barra e a
marca de hoje diz se o gasto está à frente do mês.

## Navegação

| Tela de hoje                     | Onde fica                                   |
| -------------------------------- | ------------------------------------------- |
| Dashboard                        | **Início**                                  |
| Extrato                          | **Extrato**                                 |
| Nova transação (botão flutuante) | **+** na barra                              |
| Lançamentos do mês               | **Planejar**, como os passos 1 a 3 do plano |
| Orçamento                        | Planejar › Acompanhar › Limites             |
| Cartões e fatura                 | Planejar › Acompanhar › Fatura              |
| Cofrinhos                        | Planejar › passo 3                          |
| Relatórios e Histórico           | **Mais** › Análises                         |
| Família e Alternar família       | Mais › Família; troca rápida no Início      |
| Categorias, Métodos de pagamento | Mais › Cadastros                            |
| Perfil, Ajuda, Sair              | Mais › Conta                                |
| Configurações                    | Deixa de existir; vira a tela Mais          |

## Plano do mês

Os quatro passos espelham a planilha da família. Cada passo mostra quantos itens
já foram lançados e o subtotal.

1. **Receitas** — salários e outras entradas.
2. **Contas fixas** — luz, financiamento, condomínio, gás e as demais que se
   repetem todo mês.
3. **Cofrinhos** — o que tem de ser guardado em cada cofrinho.
4. **Lazer de cada um** — o direito de cada pessoa no mês, menos o lazer dela no
   cartão, na fatura que vence no mês.

`Sobra do plano = receitas − contas fixas − cofrinhos − direito de lazer`.

O que já existe: a tela Lançamentos do mês e os modelos de lançamento
(`templates_transacao`), que ela já separa em receitas, despesas e cofrinhos
(`apps/web/src/pages/lancamentos-page.tsx`); `transacoes.usuario_registrou_id`
guarda quem lançou.

O que é novo: o direito de lazer por membro, a indicação de quem é o dono de um
gasto de lazer (pode ser outra pessoa que não quem lançou, ou "da família") e a
tela do passo 4.

Ponto de atenção: "fatura que vence no mês" não é o `mes_referencia` do
lançamento quando o vencimento cai no mês seguinte ao fechamento. No cartão de
teste (fecha dia 25, vence dia 5), a fatura que vence em 05/11 fechou em 25/10.
O desenho da Entrega 4 precisa definir essa conversão.

## Ambiente para validar no navegador

Suba o app contra o banco isolado do E2E, e não com `pnpm dev` direto:

- `apps/api/.env` aponta o banco para o cluster do Pi, e a API roda migrations ao
  subir.
- A porta 5432 local pertence a outro projeto.
- A porta 5173 costuma estar ocupada fora do WSL.

```bash
pnpm --filter @nossagrana/e2e setup:db
DATABASE_URL="postgresql://nossagrana_e2e:nossagrana_e2e@localhost:5433/nossagrana_e2e" pnpm --filter api dev
VITE_API_URL="" VITE_WS_URL="" pnpm --filter web exec vite --host 0.0.0.0 --port 5180 --strictPort
```

Numa worktree não existe `apps/api/.env`: passe também `JWT_SECRET`,
`REFRESH_TOKEN_SECRET` e `ADMIN_SECRET` (32 caracteres ou mais; valores
descartáveis servem), `REFRESH_COOKIE_SECURE=false` e
`CORS_ORIGIN=http://localhost:5180` no comando da API. A API responde em
`/api/health`.

Para rodar o E2E contra esse ambiente, use `BASE_URL=http://localhost:5180` e
`API_URL=http://localhost:3000`. O servidor não sobe com `NODE_ENV=test`, então o
limite de requisições fica ligado (3 cadastros e 5 logins por minuto); a suíte
espera a vez sozinha e leva cerca de 10 minutos. Comandos, variáveis e o porquê do
ritmo estão em [`apps/e2e/README.md`](../../apps/e2e/README.md).

Ao terminar, encerre os processos e rode
`docker compose -f apps/e2e/docker-compose.e2e.yml down -v`.

## Perguntas em aberto

1. **O que "Confirmar lazer" gera** (Entrega 4): um lançamento por pessoa, uma
   transferência ou só o registro do valor disponível?
2. **Emoji do cofrinho** (Entrega 4): o emoji que a família escolhe para cada
   cofrinho (`cofrinhos.emoji`) continua, ou vira um seletor de ícones lucide? A
   Entrega 1 não mexe nele.

Respondida em 2026-11-16, na decisão 17: biblioteca de rotas.

Respondidas em 2026-11-15 e movidas para as decisões 13 a 16: ordem das
entregas, tema escuro, primeira parcela e fonte.

## Referências

Canvases no claude.ai do usuário (privados; abra com a ferramenta de artifacts
quando disponível). Este arquivo e `telas.md` bastam sem eles.

- Direção escolhida, seis telas: https://claude.ai/artifact/Y5wKE9uDjH439rZUHtuPp3
- As três propostas comparadas: https://claude.ai/artifact/Vbo9mf4yKdC6LpHmztpiFj
- Auditoria com capturas: https://claude.ai/artifact/GCiyQtihzWzHeLgig6udun
