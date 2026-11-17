# Nova UI — Entrega 3: Extrato e Lançar

**Estado:** aprovado pelo usuário em 2026-11-16. **Data:** 2026-11-16.
Direção e sistema visual: [`docs/nova-ui/README.md`](../../nova-ui/README.md).
Roteiro das telas: [`docs/nova-ui/telas.md`](../../nova-ui/telas.md), seções
"Extrato" e "Lançar". Evidências: [`docs/nova-ui/auditoria.md`](../../nova-ui/auditoria.md).

## Por quê

Extrato e Lançar são as duas telas que a família mais usa, e são as que mais
sofrem hoje. O Extrato lista na ordem de criação, mostra a data como
`2026-11-16`, cabe cinco lançamentos por tela e não atualiza depois de salvar. O
formulário de lançar começa pelo tipo e pela categoria, o botão de salvar sai
da tela quando há parcelas, a exclusão usa a confirmação nativa do navegador e
nada avisa que o lançamento foi gravado.

A Entrega 3 redesenha o miolo dessas duas telas. A navegação (Entrega 2) e a
base visual (Entrega 1) já estão prontas.

## Decisões que este desenho assume

Escolhas do Claude, por delegação do usuário; entram em "Decisões fechadas" do
README quando este desenho for aprovado.

| Assunto                      | Escolha                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correções antes do redesenho | A entrega começa por um PR pequeno com os três defeitos achados nos testes E2E (limite duplicado, membros que não recarregam, erro 500 no limite de login) |
| Ordem do Extrato             | Do mais recente para o mais antigo, agrupado por dia, com o total do dia                                                                                   |
| Categorias "mais usadas"     | As seis categorias com mais lançamentos da família nos últimos 60 dias, calculadas no próprio app a partir dos lançamentos; sem mudança na API             |
| Desfazer                     | O aviso "Despesa lançada" traz "Desfazer" por 6 segundos; desfazer exclui o lançamento recém-criado, com as parcelas ou repetições dele                    |
| Confirmação de exclusão      | Painel próprio do app, no lugar do `window.confirm`                                                                                                        |
| Voz                          | Botão de microfone visível ao lado do valor, além do toque longo no "+"                                                                                    |
| "Lazer de quem"              | Fica para a Entrega 4, junto com o direito de lazer por pessoa                                                                                             |
| Paginação do Extrato         | Continua carregando o mês inteiro, como hoje; o mês de uma família cabe em uma carga                                                                       |

## Objetivos

1. O Extrato mostra os lançamentos por dia, do mais recente para o mais antigo,
   com data legível e total do dia; cabem sete lançamentos e os cabeçalhos de
   dia em 844px de altura.
2. Resumo do período (entradas, saídas, saldo), filtros e busca no topo do
   Extrato.
3. Salvar, editar ou excluir um lançamento atualiza a lista e o resumo na
   hora, sem sair da tela.
4. Lançar começa pelo valor; categoria, data e forma de pagamento são
   escolhidas por chips; o botão de salvar fica fixo no rodapé.
5. Descrição, parcelas e repetição ficam em "Mais opções".
6. Depois de salvar aparece um aviso com "Desfazer"; excluir pede confirmação
   num painel do app.
7. Os três defeitos listados em "Decisões" deixam de existir, e os testes E2E
   marcados com `test.fixme` passam a rodar.

## Fora do escopo

- "Lazer de quem" e o aviso de em que mês o lazer desconta (Entrega 4).
- Início novo e os quatro passos do plano (Entrega 4).
- Mudança de contrato da API de transações, além do que as correções pedem.
- Desktop redesenhado: o Extrato e o Lançar novos precisam funcionar no
  desktop, sem desenho próprio para ele.
- Mês selecionado no endereço.

## O que seria um fracasso

- Um lançamento salvo não aparecer na lista, ou aparecer no dia errado por
  causa de fuso.
- "Desfazer" apagar outro lançamento que não o recém-criado, ou deixar parcelas
  órfãs.
- O botão de salvar ficar escondido atrás do teclado virtual ou fora da tela.
- O total do dia ou o resumo do período não bater com a soma das linhas
  mostradas.
- Corrigir o limite duplicado apagando o histórico de limites de meses
  anteriores.

## Abordagens consideradas

| Abordagem                                            | Troca                                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Três PRs: correções, Extrato, Lançar (escolhida)** | O PR de correções mexe na API e é pequeno; Extrato e Lançar são só `apps/web` e podem ser validados um de cada vez |
| Um PR para Extrato e Lançar juntos                   | Menos ciclos, mas mistura duas telas grandes e dificulta achar a causa de um defeito                               |
| Agrupar e somar por dia na API                       | Menos trabalho no app, mas muda o contrato da API sem necessidade: o mês inteiro já é carregado                    |

## Telas

### Extrato

```
Extrato                          ‹ Novembro ›
┌──────────────────────────────────────────┐
│ Entradas      Saídas         Saldo       │
│ R$ 8.200,00   R$ 5.431,20    R$ 2.768,80 │
└──────────────────────────────────────────┘
[ Tudo ] [ Saídas ] [ Entradas ]     🔍  ⋯

HOJE · SEG, 16 NOV                 −R$ 189,90
▢ Mercado            Alimentação · Pix    R$ 129,90
▢ Farmácia           Saúde · Nubank       R$ 60,00
ONTEM · DOM, 15 NOV                +R$ 4.100,00
▢ Salário            Salário              R$ 4.100,00
```

(Os símbolos acima só indicam posição; na tela são ícones `lucide`.)

1. **Cabeçalho de aba** com a pílula de mês (já existe).
2. **Resumo do período** em três colunas: Entradas em verde, Saídas e Saldo em
   texto neutro (saldo negativo em vermelho). Acompanha o filtro e a busca.
3. **Filtros:** chips Tudo, Saídas e Entradas; à direita, botão de buscar (abre
   o campo de busca por descrição) e botão de mais ações, onde fica "Exportar
   CSV".
4. **Lista por dia:** cabeçalho de 34px com a data ("Hoje · seg, 16 nov",
   "Ontem · dom, 15 nov", "Sex, 13 nov") e o total do dia à direita. Linhas de
   no mínimo 52px: ícone da categoria (38×38), descrição (ou o nome da
   categoria, se não houver descrição), categoria e forma de pagamento no
   metadado, valor à direita; parcela aparece como "3/10" no metadado. Tocar na
   linha abre a edição.
5. **Estados:** carregando, erro com "Tentar de novo", mês sem lançamentos, e
   busca ou filtro sem resultado.

O ícone e as cores de cada categoria seguem as famílias definidas no README;
categoria sem família definida usa a de "outros".

### Lançar

```
            ───
[ Despesa | Receita ]                     ✕
R$  0,00                                  🎤

Categoria
[ Alimentação ] [ Mercado ] [ Lazer ] [ Todas ]
Quando
[ Hoje ] [ Ontem ] [ Outra data ]
Pago com
[ Pix ] [ Nubank ] [ Dinheiro ]
Descrição, parcelas e repetição            ›
──────────────────────────────────────────
[            Salvar despesa              ]
```

1. Alça, alternador Despesa/Receita e fechar.
2. **Valor:** campo grande (56/800) com teclado decimal, e o botão de voz ao
   lado.
3. **Categoria:** chips com as seis mais usadas do tipo escolhido e "Todas",
   que abre a lista completa. Na edição, a categoria do lançamento aparece
   selecionada mesmo que não esteja entre as seis.
4. **Quando:** Hoje, Ontem e "Outra data" (abre o seletor de data).
5. **Pago com:** um chip por forma de pagamento ativa da família; opcional,
   como hoje.
6. **Mais opções:** uma linha que expande descrição, parcelas (só com cartão de
   crédito) e repetição.
7. **Rodapé fixo:** "Salvar despesa" ou "Salvar receita"; desabilitado sem
   valor ou sem categoria, com o motivo escrito. Na edição, "Excluir" fica em
   "Mais opções".

Depois de salvar, o painel fecha e aparece o aviso "Despesa lançada" (ou
"Receita lançada") com "Desfazer", por 6 segundos, acima da barra. Excluir abre
um painel de confirmação com o nome e o valor do lançamento.

## Correções (PR 1)

| Defeito                                                              | Correção                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Editar o limite de uma categoria na mesma vigência grava outra linha | Na mesma vigência, o limite existente é atualizado; em vigência nova continua valendo o histórico |
| Aprovar uma solicitação de entrada não recarrega os membros          | A tela da família recarrega a lista depois de aprovar ou rejeitar                                 |
| Estourar o limite de requisições no login devolve erro 500           | A resposta passa a ser 429 com a mensagem "Muitas tentativas…", no formato de erro da API         |

Se já existirem limites duplicados gravados (mesma família, categoria e
vigência), o plano do PR define como tratá-los depois de olhar os dados de dev;
nenhum limite de outro mês é apagado.

## Como sai

Três PRs em sequência, cada um pelo fluxo do Checkpoint (um subagente
desenvolve, outro valida, outro revisa e abre o PR; Codex e CI verdes; merge e
deploy em dev):

1. **Correções** — os três defeitos; os testes E2E de limite e de membros saem
   do `test.fixme`.
2. **Extrato** — lista por dia, resumo, filtros, busca, estados, e a
   atualização da lista ao salvar, editar ou excluir (o terceiro `test.fixme`
   sai).
3. **Lançar** — o painel novo, o aviso com desfazer e a confirmação de
   exclusão.

## Validação

- `pnpm quality` em cada commit; `bash scripts/test-pg.sh` no PR 1, se houver
  mudança de dados.
- Navegador em 390×844, no ambiente isolado: as medidas da Entrega 1, mais os
  cenários de cada tela (ordem e totais conferidos contra os dados, lançar em
  três toques, salvar com o teclado aberto, desfazer, excluir).
- Testes E2E dos specs tocados, no ritmo descrito em `apps/e2e/README.md`.

## Riscos

| Risco                                                 | Tratamento                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Agrupar por dia no fuso errado                        | A data do lançamento já é uma data sem hora; o agrupamento usa essa data, sem converter fuso                                         |
| "Desfazer" de lançamento parcelado ou recorrente      | O plano confere o que a exclusão do lançamento pai faz hoje; se não levar as parcelas, o desfazer só aparece para lançamento simples |
| Seis "mais usadas" de uma família nova, sem histórico | Sem histórico, aparecem as seis primeiras categorias padrão do tipo                                                                  |
| Teclado virtual cobrindo o rodapé                     | O painel usa a altura visível da tela (`dvh`) e o rodapé fica dentro dele; conferido na validação                                    |

## O que fica para quem implementa

- Nomes dos componentes novos e a divisão do `transacao-modal.tsx` (425 linhas)
  em partes menores.
- Onde mora o aviso com desfazer (componente e estado).
- A forma exata do cálculo das "mais usadas" e do desempate.
- Como tratar limites duplicados já gravados.
