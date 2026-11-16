# Auditoria mobile de 2026-11-14

O que foi observado navegando o app em 390×844 com uma família de teste. Cada
item diz em que entrega é resolvido (ver o Checkpoint no
[`README.md`](README.md#checkpoint)). As referências de linha foram conferidas na `main`
de 2026-11-15 (`e8453f7`); confira de novo antes de editar.

## Bugs funcionais

| Bug                                        | Evidência                                                                                                                    | Onde                                                            | Entrega |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------- |
| Data padrão um dia à frente depois das 21h | Às 23:11 de 14/11 o formulário abriu com 15/11; a data vem de `toISOString()`, que é UTC                                     | `apps/web/src/components/transacao-modal.tsx:45`                | 1       |
| Primeira parcela gravada com o valor total | Compra de R$ 1.299,90 em 10x: novembro com R$ 1.299,90, dezembro com R$ 129,99. Só as parcelas filhas recebem `valorParcela` | `apps/api/src/modules/transacao/transacao.plano-registro.ts:57` | 1       |
| Orçamento "vigente desde" o mês anterior   | Criado em novembro, mostra "out. de 2026": `new Date('2026-11-01')` é lido como UTC                                          | `apps/web/src/pages/orcamento-page.tsx:173`                     | 1       |
| Pizza some com uma categoria só            | Com 100% em uma categoria o arco começa e termina no mesmo ponto                                                             | `describeArc` em `apps/web/src/components/charts/pie-chart.tsx` | 1       |
| Textos sem acento                          | Categorias padrão (Alimentacao, Saude, Educacao, Salario, Bonus) e frases como "Movimentacoes"                               | Seed de categorias e páginas de cofrinho                        | 1       |

## Problemas de interface

| Problema                                            | Evidência                                                                                                 | Onde                                                                  | Entrega |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- |
| Telas sem entrada no celular                        | "Lançamentos" e "Alternar família" só existem no menu lateral do desktop                                  | `apps/web/src/components/sidebar.tsx:33` e `:47`                      | 2       |
| Config como gaveta                                  | Orçamento, cofrinhos, cartões e histórico dentro de Config; a fatura fica a três toques                   | `apps/web/src/pages/configuracoes-page.tsx`                           | 2       |
| Sem histórico de navegação                          | As telas são um estado do React, sem URL; o voltar do Android sai do app                                  | `apps/web/src/App.tsx:68`                                             | 2       |
| "+" flutuante cobre valores e modais                | Fixo em todas as telas com o mesmo `z-50` dos modais                                                      | `apps/web/src/components/app-shell.tsx:121`                           | 1 e 2   |
| Valores cortados no dashboard                       | "R$ 12.700,00" precisa de 108px e tem 85px nos três cartões lado a lado                                   | `apps/web/src/pages/dashboard-page.tsx`                               | 1 e 4   |
| Extrato fora de ordem                               | Lista na ordem de criação, datas como `2026-11-15`, cartões de 90px (cinco por tela)                      | `apps/web/src/pages/extrato-page.tsx`                                 | 3       |
| Salvar sai da tela no formulário                    | Com "Parcelado", o rodapé termina em 855px numa tela de 844px                                             | `apps/web/src/components/transacao-modal.tsx`                         | 3       |
| Campos em 14px                                      | Cerca de 25 campos; o iPhone dá zoom ao focar                                                             | Formulários em `components/` e `pages/`                               | 1       |
| Alvos pequenos                                      | Fechar com 13×24, setas de mês com 20×32, filtros com 26px de altura, "editar/desativar" em texto de 12px | `month-nav.tsx`, `extrato-page.tsx`, `categorias-page.tsx`            | 1       |
| Exclusão com `window.confirm`                       | Única confirmação nativa do app                                                                           | `apps/web/src/components/transacao-modal.tsx:393`                     | 3       |
| Fundo claro atrás do app e rolagem fantasma         | `<body class="bg-slate-50">` vence o `bg-bg`; toda tela tem 912px de altura em 844px (os 68px da barra)   | `apps/web/index.html`, `app-shell.tsx:94`, `min-h-screen` nas páginas | 1       |
| Sem área segura no iPhone                           | A classe `pb-safe` não existe e o viewport não tem `viewport-fit=cover`                                   | `apps/web/src/components/bottom-nav.tsx:23`, `apps/web/index.html`    | 1       |
| Fonte nunca carregada                               | Manrope declarada em `index.css`, sem nenhum carregamento                                                 | `apps/web/src/index.css`                                              | 1       |
| Manifest fora da paleta                             | `theme_color` teal e `background_color` claro; ícones só em SVG                                           | `apps/web/vite.config.ts`                                             | 1       |
| Botão verde com texto branco                        | Contraste de 2,3:1 sobre `#22C55E`                                                                        | Botões primários                                                      | 1       |
| Quatro estilos de "voltar" e cabeçalhos que quebram | Seta, pílula "Voltar", "← Voltar" e link azul; "Cartões e Pagamentos" quebra em duas linhas               | Cabeçalho de cada página                                              | 2       |
| Oito tours de primeira visita                       | Um modal por tela                                                                                         | `FirstTimeTour` em oito páginas                                       | 2       |
| Emojis e símbolos de texto como ícones              | Nos tours, nos cofrinhos, no cartão de método de pagamento, em "✕", "◀" e "▶"                             | 14 arquivos de `components/` e `pages/`; liste com `grep` ao trocar   | 1       |
| Sem aviso ao salvar                                 | O modal fecha sem confirmação visível                                                                     | `apps/web/src/App.tsx`                                                | 3       |
| Relatórios repetem o dashboard                      | Mesma pizza e mesma lista; Tendências sem valores; Histórico expõe "Gerar Snapshot"                       | `relatorios-page.tsx`, `historico-page.tsx`                           | Depois  |

## O que não foi coberto

Seletor de família (precisa de duas famílias), gravação por voz, modais de
retirada e de encerramento de cofrinho, gerenciador de modelos. No desktop, só o
dashboard e a tela Lançamentos.
