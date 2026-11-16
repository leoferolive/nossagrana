# Nova UI — Entrega 2: navegação

**Estado:** aguardando aprovação do usuário. **Data:** 2026-11-16.
Direção e sistema visual: [`docs/nova-ui/README.md`](../../nova-ui/README.md).
Evidências dos problemas: [`docs/nova-ui/auditoria.md`](../../nova-ui/auditoria.md).

## Por quê

Hoje cada tela é um estado do React, sem URL. O voltar do Android sai do app,
recarregar cai sempre no dashboard e não existe link direto para nada. No
celular, "Lançamentos" e "Alternar família" não têm entrada, e orçamento,
cofrinhos, cartões e histórico ficam guardados dentro de Config. O "+" flutuante
cobre conteúdo, cada tela tem seu estilo de "voltar" e existem oito tours de
primeira visita.

A Entrega 2 troca o esqueleto de navegação do app. O conteúdo das telas continua
o de hoje: Extrato e Lançar mudam na Entrega 3; Início e o plano do mês, na
Entrega 4.

## Decisões que este desenho assume

Escolhas do Claude, por delegação do usuário; entram em "Decisões fechadas" do
README quando este desenho for aprovado.

| Assunto             | Escolha                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Biblioteca de rotas | `react-router` 7, no modo declarativo (`BrowserRouter`)                                                |
| Endereços           | Em português, curtos, agrupados pela aba: `/extrato`, `/planejar/cofrinhos`, `/mais/categorias`        |
| Painel de lançar    | Abrir o painel acrescenta um passo ao histórico: o voltar do Android fecha o painel, e não sai da tela |
| Barra inferior      | Aparece nas quatro abas e nas telas de segundo nível, com a aba de origem marcada                      |
| Tour                | Um único tour de boas-vindas, mostrado uma vez a todos (inclusive a quem já viu os tours antigos)      |
| Mês na URL          | Fica fora desta entrega; só a fatura leva o mês no endereço, porque ele identifica a fatura            |
| Troca de família    | Entra em Mais › Família. A troca rápida no topo do Início vem com o Início novo, na Entrega 4          |

## Objetivos

1. Toda tela tem endereço. Recarregar mantém a tela, o voltar do Android volta
   uma tela dentro do app, e um link direto abre a tela certa depois do login.
2. A barra inferior tem cinco posições (Início · Extrato · + · Planejar · Mais)
   com o "+" dentro dela; o botão flutuante deixa de existir.
3. Toda tela do celular é alcançável em até dois toques a partir da barra.
4. Existe um só estilo de cabeçalho de aba e um só de cabeçalho de detalhe.
5. Existe um só tour de boas-vindas.
6. Os testes E2E voltam a passar, um por vez, contra o ambiente isolado.

## Fora do escopo

- Conteúdo novo de tela: Extrato e Lançar (Entrega 3), Início e os quatro
  passos do plano (Entrega 4). Planejar, aqui, é só a tela de entrada.
- Redesenho do desktop. O menu lateral continua, reorganizado nos mesmos
  grupos e apontando para os mesmos endereços.
- Mês selecionado no endereço das telas.
- Telas de login, cadastro e onboarding: ganham endereço, mas o desenho fica.

## O que seria um fracasso

- Recarregar ou abrir um link direto mostrar dado de outra família, ou uma tela
  protegida sem login.
- Depois do login, o usuário cair no Início em vez da tela que tinha pedido.
- O voltar do Android, com o painel de lançar aberto, descartar o que foi
  digitado e ainda sair da tela.
- O app instalado (PWA) abrir em branco num endereço interno quando está sem
  rede.
- Alguma tela de hoje ficar sem entrada no celular.

## Abordagens consideradas

| Abordagem                                           | Troca                                                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **`react-router` 7, modo declarativo (escolhida)**  | Padrão de fato, bem documentado, rotas aninhadas e parâmetros prontos; acrescenta cerca de 20 kB ao pacote                          |
| `wouter`                                            | Cerca de 2 kB e API parecida, mas menos recursos (guardas, layouts aninhados e redirecionamentos ficam por nossa conta) e menos uso |
| Manter o estado atual e sincronizar com a URL à mão | Nenhuma dependência, mas reescreve por conta própria o que uma biblioteca já resolve, com mais risco no voltar e no link direto     |

O servidor já está pronto para isso: o `nginx.conf` do Web devolve o
`index.html` para qualquer endereço desconhecido.

## Mapa de endereços

| Endereço                                 | Tela                           | Aba marcada |
| ---------------------------------------- | ------------------------------ | ----------- |
| `/entrar`, `/cadastro`                   | Login, cadastro                | sem barra   |
| `/boas-vindas`, `/familias`              | Onboarding, seletor de família | sem barra   |
| `/`                                      | Início (dashboard de hoje)     | Início      |
| `/extrato`                               | Extrato                        | Extrato     |
| `/planejar`                              | Planejar (tela de entrada)     | Planejar    |
| `/planejar/contas`                       | Lançamentos do mês             | Planejar    |
| `/planejar/limites`                      | Orçamento                      | Planejar    |
| `/planejar/cofrinhos`                    | Cofrinhos                      | Planejar    |
| `/planejar/cofrinhos/:cofrinhoId`        | Detalhe do cofrinho            | Planejar    |
| `/planejar/fatura/:metodoId?mes=AAAA-MM` | Fatura do cartão               | Planejar    |
| `/mais`                                  | Mais                           | Mais        |
| `/mais/relatorios`, `/mais/historico`    | Relatórios, Histórico          | Mais        |
| `/mais/familia`                          | Família                        | Mais        |
| `/mais/categorias`                       | Categorias                     | Mais        |
| `/mais/metodos-pagamento`                | Métodos de pagamento           | Mais        |
| `/mais/perfil`, `/mais/ajuda`            | Perfil, Ajuda                  | Mais        |

O painel de lançar não é uma tela: abre sobre a tela atual e é controlado por
um parâmetro do endereço (`?lancar=nova` ou `?lancar=<id da transação>`).
Endereço desconhecido leva ao Início.

**Guardas:** sem login, qualquer endereço protegido leva a `/entrar` e, depois
do login, o app volta ao endereço pedido. Com login e sem família, leva a
`/boas-vindas`. Com mais de uma família e nenhuma ativa, leva a `/familias`. O
`familiaId` continua vindo da sessão, nunca do endereço; os ids de cofrinho e de
método de pagamento no endereço são validados pela API, como já são hoje.

## Telas e componentes novos

### Barra inferior

Medidas do sistema visual do README: 84px mais a área segura, cinco colunas,
"+" central de 58px subindo 28px, com anel de 6px na cor do fundo. O "+" abre o
painel de lançar; segurar continua acionando a voz.

```
┌──────────────────────────────────────────┐
│                  ( + )                   │
│  Início   Extrato          Planejar  Mais│
└──────────────────────────────────────────┘
```

### Cabeçalhos

- **De aba:** título em 26/800 à esquerda; à direita, a pílula de mês nas telas
  que têm mês.
- **De detalhe:** voltar de 44×44, título em 20/800 e, quando houver, uma ação
  à direita. O voltar retorna à tela anterior do app; se a tela foi aberta por
  link direto, vai para a tela de origem do mapa (por exemplo, de
  `/mais/categorias` para `/mais`).

Os quatro estilos de "voltar" de hoje somem.

### Mais

Substitui a tela Configurações. Lista em quatro grupos:

```
Mais
─ Análises    Relatórios · Histórico
─ Família     Família · Alternar família
─ Cadastros   Categorias · Métodos de pagamento
─ Conta       Perfil · Ajuda · Sair
```

### Planejar (tela de entrada)

Título e quatro linhas em cartão, cada uma com o resumo que as telas atuais já
calculam. O plano em quatro passos e a "sobra do plano" são da Entrega 4.

```
Planejar                         ‹ Novembro ›
┌──────────────────────────────────────────┐
│ Contas do mês         5 de 10 lançadas  ›│
│ Limites por categoria 1 de 4 estourado  ›│
│ Fatura Nubank         vence 05/12       ›│
│ Cofrinhos             3 ativos          ›│
└──────────────────────────────────────────┘
```

Havendo mais de um cartão, aparece uma linha de fatura para cada um.

### Tour de boas-vindas

Um tour de quatro passos, no primeiro acesso ao Início: o que é o Início, onde
lançar (o "+"), o que há em Planejar e o que há em Mais. Os oito tours por tela
são removidos. "Rever tutorial", em Ajuda, reabre este tour.

## Como sai

Três PRs em sequência, cada um pelo fluxo registrado no Checkpoint (um
subagente desenvolve, outro valida, outro revisa e abre o PR; Codex e CI verdes;
merge e deploy em dev):

1. **Rotas com URL.** Entra o roteador com o mapa de endereços, as guardas e o
   painel de lançar no endereço. A barra e a tela Configurações de hoje
   continuam, apontando para os endereços novos. O ganho já aparece: voltar do
   Android, recarregar e link direto.
2. **Barra de cinco, Mais, Planejar, cabeçalhos e tour.** A mudança visível de
   navegação. O "+" flutuante e a tela Configurações saem.
3. **E2E ajustados.** Os seis specs passam a navegar pelos endereços e pelos
   nomes novos, corrigindo também o que já estava quebrado na `main`.

## Validação

- `pnpm quality` em cada commit.
- Navegador em 390×844, no ambiente isolado: recarregar em cada tela, voltar
  do navegador em cada nível, link direto com e sem login, painel de lançar
  fechando com o voltar, e as medidas da Entrega 1 (rolagem, alvos de 44px,
  campos em 16px) em todas as telas.
- PWA: com o app construído, abrir um endereço interno sem rede.
- E2E no PR 3, um teste por vez, por causa do limite de requisições da API.

## Riscos

| Risco                                                                 | Tratamento                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Os quatro arquivos de teste do `App` dependem da navegação por estado | São reescritos no PR 1 sobre o roteador em memória, mantendo os mesmos cenários                     |
| Service worker devolver o `index.html` para chamadas de API           | `/api` e `/health` ficam fora do retorno de navegação do service worker                             |
| Quem tem o app instalado ficar com a versão antiga em cache           | O service worker já atualiza sozinho (`autoUpdate`); conferir na validação que a versão nova assume |
| Dezesseis páginas recebem a navegação por propriedades                | No PR 1 passam a usar o roteador; a troca é mecânica e coberta pelos testes de cada página          |

## O que fica para quem implementa

- Nomes dos componentes de cabeçalho, da tela Mais e da tela Planejar.
- Como guardar o endereço pedido antes do login.
- Texto dos quatro passos do tour.
- A forma do auxiliar de teste que monta uma página dentro do roteador.
