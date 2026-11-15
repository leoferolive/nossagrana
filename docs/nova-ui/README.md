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

**Estado em 2026-11-15:** direção aprovada, ordem das entregas confirmada, desenho
da Entrega 1 aprovado e plano do PR 1 escrito; nenhuma linha de código do
redesenho escrita. **Próximo passo:** executar o
[plano do PR 1 (Correções)](../superpowers/plans/2026-11-15-nova-ui-entrega-1-pr1-correcoes.md).
O PR 2 (Base visual) ganha plano próprio depois do merge do PR 1.

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
- [ ] Data padrão do lançamento em horário local
- [ ] Primeira parcela com o valor da parcela, corrigindo também os
      parcelamentos já gravados
- [ ] "Vigente desde" do orçamento no mês certo
- [ ] Gráfico de pizza com uma única categoria
- [ ] Acentos nas categorias padrão e nos textos
- [ ] Tokens com os valores novos e os tokens adicionais
- [ ] Manrope carregada pelo próprio app
- [ ] Fundo do `body`, `theme-color` e manifest na paleta nova
- [ ] Altura do shell sem rolagem fantasma
- [ ] Área segura do iPhone na barra inferior
- [ ] Campos em 16px e alvos de toque com 44px
- [ ] Escala de z-index: barra, "+", painel/modal, aviso
- [ ] Valores do dashboard sem corte em 390px
- [ ] Emojis trocados por ícones lucide

### Entrega 2 — Navegação

- [ ] Rotas com URL (voltar do Android, recarregar mantém a tela, link direto)
- [ ] Barra de cinco posições com o "+" dentro
- [ ] Cabeçalho único de aba e de passo/detalhe
- [ ] Tela Mais
- [ ] Planejar como entrada para orçamento, cartões, cofrinhos e contas do mês
- [ ] Um único tour de boas-vindas
- [ ] E2E ajustados à nova navegação

### Entrega 3 — Extrato e Lançar

- [ ] Extrato em ordem cronológica, agrupado por dia, com total do dia
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

### Diário

- 2026-11-15 — Arquivo criado com a direção aprovada. Nada implementado.
- 2026-11-15 — O usuário delegou as respostas das perguntas em aberto; ordem das
  entregas, tema, primeira parcela e fonte decididas (decisões 13 a 16). Desenho
  da Entrega 1 escrito, aguardando aprovação.
- 2026-11-15 — Desenho da Entrega 1 aprovado pelo usuário. Plano do PR 1
  (Correções) escrito.

## Decisões fechadas

| #   | Decisão                                                                                                                                                                | Por quê                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Celular primeiro, tela de referência 390×844                                                                                                                           | É onde a família lança e consulta                                               |
| 2   | Estrutura "Mês em foco": um número principal por tela, régua do mês, cartões                                                                                           | Proposta A, escolhida pelo usuário                                              |
| 3   | Paleta clara: papel esverdeado, tinta verde-escura, um acento verde                                                                                                    | Paleta da proposta B, escolhida pelo usuário                                    |
| 4   | Fonte Manrope em tudo, com números tabulares                                                                                                                           | Já é a fonte declarada no app; hoje ela nunca é carregada                       |
| 5   | Barra inferior: Início · Extrato · + · Planejar · Mais                                                                                                                 | O "+" flutuante cobria valores e modais                                         |
| 6   | Toda tela tem URL                                                                                                                                                      | Hoje o voltar do Android sai do app e recarregar cai no dashboard               |
| 7   | Planejar é o **plano do mês** em quatro passos: receitas, contas fixas, cofrinhos, lazer de cada um                                                                    | É a ordem em que a família preenche a planilha                                  |
| 8   | Lazer disponível = direito fixo da pessoa − lazer dela no cartão, na fatura que vence no mês                                                                           | Regra da planilha, confirmada pelo usuário                                      |
| 9   | Verde é a única cor de ação; vermelho só para alerta; saída em texto neutro, entrada em verde                                                                          | Na auditoria, verde, azul, laranja e vermelho disputavam a ação principal       |
| 10  | Os nomes dos tokens Tailwind ficam (`bg-bg`, `bg-panel`, `text-text-muted`…); mudam os valores                                                                         | `.claude/rules/code-style.md` já os define; evita renomear o app inteiro        |
| 11  | Ícones só de `lucide-react`; nenhum emoji na interface                                                                                                                 | Regra do projeto de uma biblioteca de ícones                                    |
| 12  | Alvos de toque com 44px, campos em 16px, texto com contraste mínimo de 4,5:1                                                                                           | Campos em 14px dão zoom no iPhone; botão verde com texto branco tinha 2,3:1     |
| 13  | Ordem das entregas: 1 → 2 → 3 → 4                                                                                                                                      | Planejar é uma aba da barra nova e seus passos têm URL, então a 4 depende da 2  |
| 14  | Só o tema claro; o tema escuro deixa de existir                                                                                                                        | O app nunca teve alternador; os tokens são variáveis CSS, dá para voltar depois |
| 15  | Primeira parcela com o valor total é bug: o pai passa a valer a parcela e os já gravados são corrigidos, com os snapshots dos meses afetados marcados como divergentes | Os totais somam `valor`; R$ 1.299,90 em 10x pesava R$ 2.469,81                  |
| 16  | Manrope pelo pacote `@fontsource-variable/manrope`, no build do app e no cache offline                                                                                 | O app é um PWA e a fonte precisa funcionar sem rede                             |

As decisões 13 a 16 foram escolhidas pelo Claude em 2026-11-15, por delegação do
usuário.

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

Ao terminar, encerre os processos e rode
`docker compose -f apps/e2e/docker-compose.e2e.yml down -v`.

## Perguntas em aberto

1. **O que "Confirmar lazer" gera** (Entrega 4): um lançamento por pessoa, uma
   transferência ou só o registro do valor disponível?
2. **Biblioteca de rotas** para a Entrega 2.
3. **Emoji do cofrinho** (Entrega 4): o emoji que a família escolhe para cada
   cofrinho (`cofrinhos.emoji`) continua, ou vira um seletor de ícones lucide? A
   Entrega 1 não mexe nele.

Respondidas em 2026-11-15 e movidas para as decisões 13 a 16: ordem das
entregas, tema escuro, primeira parcela e fonte.

## Referências

Canvases no claude.ai do usuário (privados; abra com a ferramenta de artifacts
quando disponível). Este arquivo e `telas.md` bastam sem eles.

- Direção escolhida, seis telas: https://claude.ai/artifact/Y5wKE9uDjH439rZUHtuPp3
- As três propostas comparadas: https://claude.ai/artifact/Vbo9mf4yKdC6LpHmztpiFj
- Auditoria com capturas: https://claude.ai/artifact/GCiyQtihzWzHeLgig6udun
