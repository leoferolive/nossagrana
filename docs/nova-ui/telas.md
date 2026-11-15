# Telas da nova UI

Roteiro de cada tela, de cima para baixo. Medidas, cores e componentes estão no
[`README.md`](README.md#sistema-visual); aqui fica só o que entra em cada tela e
em que ordem. Os números de exemplo são da família de teste da auditoria
(novembro de 2026).

## Início

1. **Topo:** botão de trocar de família (avatar quadrado com as iniciais, nome,
   seta) à esquerda; pílula de mês à direita.
2. **Número principal:** "Saldo de novembro" e o valor. Linha de apoio: quanto
   entrou (em verde) e quanto saiu.
3. **Régua do mês**, com a legenda "Hoje, dia 14 de 30" e "Dia 25 fecha o
   Nubank".
4. **Cartão "Plano de novembro":** título e, à direita, "2 de 4 prontos". Uma
   linha por passo, com marcador, nome, situação ("5 de 10 · faltam luz, água,
   gás…") e subtotal. O passo em andamento vem destacado e leva à tela dele.
5. **Aviso**, quando houver limite estourado: "Alimentação passou do limite em
   R$ 284,55".
6. **Últimos lançamentos:** dois itens e o link "Ver extrato".
7. Barra inferior, com Início ativo.

## Planejar

1. **Topo:** título "Planejar" e pílula de mês.
2. **Cartão do plano**, como conta de subtrair: Receitas (valor em verde), Contas
   fixas, Cofrinhos e Lazer de cada um (valores com "−"), cada linha com marcador
   e situação. Depois de uma linha em `text`, "Sobra do plano" com o valor em
   26/800 e, se faltar algo, a pendência em `warning` ("Ainda faltam 5 contas
   fixas para lançar").
3. **Botão primário** para o passo em andamento: "Continuar nas contas fixas".
4. **Acompanhar:** duas linhas em cartão. "Fatura Nubank" com fechamento,
   vencimento e valor; "Limites por categoria" com a situação ("Alimentação
   passou R$ 284,55") e "1 de 4".
5. Barra inferior, com Planejar ativo.

## Passo 2 · Contas fixas

Tela de fluxo, sem barra inferior.

1. **Cabeçalho de passo:** voltar, "Contas fixas", "Passo 2 de 4" e os quatro
   segmentos.
2. **"Faltam lançar em novembro"** com a contagem. Um cartão com uma linha por
   conta pendente: nome à esquerda (é o `label` do campo), "R$" e o campo de
   valor à direita. O campo em edição fica com o anel verde.
3. **"Já lançadas"** com contagem e total. Linhas compactas de 44px: check, nome,
   dia e forma de pagamento, valor. Tocar abre a edição.
4. **Rodapé de passo:** "1 conta preenchida" com a soma e o botão "Lançar conta".

Os passos 1 (Receitas) e 3 (Cofrinhos) usam este mesmo desenho, trocando a lista.

## Passo 4 · Lazer de cada um

Tela de fluxo, sem barra inferior.

1. **Cabeçalho de passo:** "Lazer de cada um", "Passo 4 de 4".
2. **Frase de regra:** "O direito de cada um no mês, menos o lazer que já entrou
   na fatura do cartão que vence em novembro."
3. **Um cartão por pessoa:** avatar redondo com a inicial, nome, "Disponível em
   novembro" e o valor disponível em 26/800. Abaixo, "Direito do mês" com o valor
   e um botão de editar, e "Lazer na fatura que vence em 05/11" com o desconto.
   Cada compra descontada aparece em uma sublinha de 12px (descrição, data,
   cartão, valor). Sem compras, a linha mostra "nenhum".
4. **Nota:** "O desconto soma os lançamentos da categoria Lazer que cada pessoa
   fez no cartão."
5. **Rodapé de passo:** "Total a liberar" e o botão "Confirmar lazer".

## Extrato

1. **Topo:** título "Extrato" e pílula de mês.
2. **Resumo do período** em três colunas: Entradas (verde), Saídas e Saldo.
3. **Filtros:** chips Tudo, Saídas e Entradas; à direita, botões de buscar e de
   mais ações (onde fica exportar CSV).
4. **Lista por dia,** do mais recente para o mais antigo. Cabeçalho de dia com a
   data legível ("Hoje · sáb, 14 nov", "Ontem · sex, 13 nov", "Qui, 12 nov") e o
   total do dia. Linhas de lançamento com categoria e forma de pagamento no
   metadado; em gasto de lazer, o metadado também diz de quem é. Tocar na linha
   abre a edição.
5. Barra inferior, com Extrato ativo.

Cabem sete lançamentos e cinco cabeçalhos de dia em 844px de altura.

## Lançar

Painel de baixo para cima sobre a tela atual.

1. Alça, alternador Despesa/Receita e o botão de fechar.
2. **Valor:** "R$", o campo grande com teclado decimal e o botão de voz.
3. **Categoria:** chips com as mais usadas e "Todas".
4. **Lazer de quem:** aparece só quando a categoria é Lazer. Chips com cada
   membro e "Da família".
5. **Quando:** Hoje, Ontem, Outra data.
6. **Pago com:** as formas de pagamento da família. Com cartão e Lazer, uma nota
   diz em que fatura entra e de que mês desconta ("Entra na fatura que vence em
   05/12 e desconta R$ 60,00 do lazer do Leo em dezembro").
7. **Mais opções:** linha "Descrição, parcelas e repetição".
8. **Rodapé fixo:** "Salvar despesa".

Depois de salvar, um aviso "Despesa lançada" com Desfazer.

## Ainda sem desenho

Desenhe cada uma antes de construir, seguindo o sistema visual:

- Passo 1 (Receitas) e passo 3 (Cofrinhos) do plano
- Mais, com Análises, Família, Cadastros e Conta
- Detalhe da fatura, Limites por categoria, detalhe do cofrinho
- Categorias, Métodos de pagamento, Família, Perfil, Ajuda
- Análises (Relatórios e Histórico juntos)
- Login, cadastro, onboarding e seletor de família
- Estados vazio, carregando e erro de cada tela
- Desktop
