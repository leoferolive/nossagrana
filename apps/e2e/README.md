# E2E (Playwright)

Os testes E2E não rodam no CI: rodam à mão, contra um ambiente isolado. São 32 testes em seis
specs (`tests/`), 31 rodando e 1 em `test.fixme` (o Extrato não atualiza a lista depois de salvar, comentado no teste; sai na Entrega 3): `auth`, `onboarding`, `familia`, `transacoes`, `orcamento` e `relatorios`.

## Subir o ambiente

O passo a passo (banco, API e Web) está em
[`docs/nova-ui/README.md`](../../docs/nova-ui/README.md), seção "Ambiente para validar no
navegador". Em resumo:

- PostgreSQL isolado na porta 5433: `pnpm --filter @nossagrana/e2e setup:db`
  (nunca use a 5432, que é de outro projeto).
- API em `http://localhost:3000` e Web em `http://localhost:5180` (veja o comando no
  `docs/nova-ui/README.md`; a API não aceita `NODE_ENV=test` de propósito).
- Para encerrar: `docker compose -f apps/e2e/docker-compose.e2e.yml down -v`.

## Rodar

Dentro de `apps/e2e`:

```bash
# Tudo, em sequência (leva cerca de 10 minutos, veja "Por que demora")
BASE_URL=http://localhost:5180 API_URL=http://localhost:3000 pnpm exec playwright test --reporter=list

# Um spec
BASE_URL=http://localhost:5180 API_URL=http://localhost:3000 pnpm exec playwright test auth --reporter=list
```

| Variável       | Padrão                  | Para quê                                                              |
| -------------- | ----------------------- | --------------------------------------------------------------------- |
| `BASE_URL`     | `http://localhost:5173` | Endereço do Web que o navegador abre                                  |
| `API_URL`      | `http://localhost:3000` | Endereço da API que os testes chamam direto (preparar e limpar dados) |
| `E2E_PAUSA_MS` | `21000`                 | Intervalo mínimo entre dois cadastros, em ms (`0` deixa só a janela)  |

A suíte leva mais que o teto de 10 minutos de um comando em primeiro plano em alguns terminais;
rode em segundo plano se for o caso.

## Por que demora

A API do ambiente isolado roda com o limite de requisições de produção: **3 cadastros, 5 logins
e 10 refreshes por minuto por IP** (e 100 requisições por minuto no total). O servidor recusa
`NODE_ENV=test`, que desligaria o limite, então a suíte não o contorna: ela espera a sua vez.
Estourar o limite devolve 429 com a mensagem "Muitas tentativas…" e o cabeçalho `retry-after`.

Cada teste é independente e cria o próprio usuário, então gasta **1 cadastro e 1 login**. Os
testes de família criam um segundo usuário (mais 1 cadastro e 1 login), e os de `auth` que passam
pelos formulários gastam as vagas deles. Uma execução completa mede 30 cadastros, 32 logins e 30
refreshes (cerca de 600 requisições no total), o que, a 3 cadastros por minuto, dá no mínimo
9 minutos; na prática, cerca de 10. Sem 429 nem 500.

Como o ritmo é cumprido:

- `workers: 1` e sem nova tentativa (`retries: 0`): refazer um teste cadastraria outro usuário.
  A suíte só funciona com um worker (o arquivo de uso abaixo não tem trava): `--workers=N` com
  N diferente de 1 faz a fixture automática `tourSuprimido` falhar com uma mensagem clara.
- Os testes com dois cadastros usam `test.slow()`: a espera do segundo entra no tempo do teste.
- `helpers/ritmo.ts` guarda quando cada cadastro e cada login aconteceu e faz uma janela
  deslizante de 60 s: `api.register` e `api.login` esperam a vaga antes de chamar a API. Os
  testes que cadastram ou entram pelo formulário usam as fixtures `vagaDeCadastroNaTela` e
  `vagaDeLoginNaTela`. Entre dois cadastros há uma pausa mínima de 21 s (60 s / 3, com folga);
  `E2E_PAUSA_MS` ajusta essa pausa.
- O uso fica em `apps/e2e/.ritmo/uso-api.json` (ignorado pelo git e pelo Prettier), e não na memória, porque o
  Playwright troca o processo do worker depois de uma falha e duas execuções seguidas precisam
  enxergar o que a anterior gastou. Para zerar o contador depois de reiniciar a API (o limite
  da API zera junto), apague a pasta `apps/e2e/.ritmo/`.
- Um login só por teste: a fixture `authContext` guarda o cookie de refresh que o login devolve
  e `abrirAppAutenticado` o entrega ao navegador, em vez de logar de novo.

## Como os testes enxergam o app

- O projeto roda em 390x844 (celular), a tela de referência do app. Nessa largura a barra inferior
  (Início, Extrato, "Lançar", Planejar, Mais) é a navegação; no desktop ela some.
- Cada tela tem endereço (`apps/web/src/routes/caminhos.ts`): os testes conferem a URL e usam
  `page.goto` para abrir telas direto.
- O tour de boas-vindas (chave `tour-boas-vindas` no `localStorage`) é suprimido em todo teste
  pela fixture automática `tourSuprimido`.
- No painel de lançar, categoria, data e forma de pagamento são chips (`aria-pressed`), e
  descrição, parcelas e repetição ficam em "Mais opções". `lancar` (`helpers/lancar.ts`) faz o
  passo a passo inteiro; `abrirPainelLancar`, `escolherCategoria` (chip ou "Todas") e
  `salvarLancamento` servem para os casos que precisam parar no meio. O aviso "Despesa lançada",
  com "Desfazer", se acha com `avisoDeLancamento`.
- Os demais seletores do app (como a frequência da repetição) são `CustomSelect`, não `<select>`:
  use `escolherOpcao` (`helpers/custom-select.ts`) em vez de `selectOption`.
- O refresh do login é rotativo: `abrirAppAutenticado` roda uma vez por teste; depois use
  `page.goto`/`reload`, que levam o cookie já rotacionado.
- A API não tem rota de exclusão de conta: os usuários dos testes ficam no banco isolado (e-mails
  únicos, sem colisão) e somem com `docker compose down -v`.
