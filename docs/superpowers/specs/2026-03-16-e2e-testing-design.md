# Design: Módulo de Testes E2E

**Data:** 2026-03-16
**Status:** Implementado

---

## 1. Contexto e motivação

O NossaGrana já conta com uma base sólida de testes automatizados: 61 arquivos de testes unitários e de integração cobrindo aproximadamente 80% do código da API (módulos de auth, famílias, transações, categorias, métodos de pagamento, orçamento, relatórios e snapshots). Esses testes garantem que a lógica de negócio está correta em isolamento.

O que estava faltando era verificar que o sistema funciona de ponta a ponta — ou seja, que o frontend React consegue autenticar um usuário, criar uma família, lançar transações e navegar entre as telas sem quebrar. Erros de integração entre frontend e backend (campos renomeados, headers ausentes, estado incorreto no Zustand) só aparecem quando as duas camadas operam juntas.

Os testes E2E foram criados para preencher essa lacuna, exercitando os fluxos críticos da aplicação através de um navegador real controlado pelo Playwright.

---

## 2. Abordagem técnica

### Framework

**Playwright** foi escolhido como framework de E2E. As razões estão detalhadas na seção de decisões técnicas.

### Estratégia híbrida de infraestrutura

| Ambiente                | Banco de dados                                                      | API                           | Frontend               |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------- | ---------------------- |
| Local (desenvolvimento) | Docker Compose em `apps/e2e/docker-compose.e2e.yml` na porta `5433` | `pnpm dev` (apps/api)         | `pnpm dev` (apps/web)  |
| CI (GitHub Actions)     | `services` nativo do GitHub Actions na porta `5433`                 | Build + `node dist/server.js` | Build + `vite preview` |

A separação do banco E2E na porta `5433` (em vez de `5432`) garante que os testes não contaminem o banco de desenvolvimento local do desenvolvedor.

### Isolamento de dados entre testes

Cada teste que utiliza as fixtures base cria um usuário único com e-mail gerado dinamicamente (`test+<timestamp>+<random>@e2e.com`) e o remove ao final via `DELETE /auth/account`. Isso torna os testes idempotentes e paralelizáveis sem colisão de dados.

---

## 3. Estrutura do workspace `apps/e2e`

```
apps/e2e/
├── package.json                # Dependências e scripts do workspace
├── playwright.config.ts        # Configuração do Playwright
├── tsconfig.json               # TypeScript para os arquivos de teste
├── docker-compose.e2e.yml      # PostgreSQL isolado (porta 5433) para uso local
├── .env.e2e.example            # Variáveis de ambiente de referência
├── helpers/
│   └── api-client.ts           # Cliente HTTP (fetch nativo) para chamadas diretas à API
├── fixtures/
│   ├── base.ts                 # Fixtures Playwright: authContext, familiaId, authenticatedPage
│   └── db.ts                   # Placeholder para fixtures de acesso direto ao banco
└── tests/
    ├── auth.spec.ts             # Fluxo de autenticação
    ├── onboarding.spec.ts       # Fluxo de onboarding (primeira família)
    ├── transacoes.spec.ts       # CRUD de transações, parcelas e recorrências
    ├── familia.spec.ts          # Gestão de família: convites, solicitações e membros
    ├── orcamento.spec.ts        # Limites de orçamento por categoria
    └── relatorios.spec.ts       # Relatórios, fatura de cartão e histórico mensal
```

---

## 4. Specs e cenários

### `tests/auth.spec.ts` — Autenticação

1. Registro com dados válidos redireciona para o onboarding.
2. Login com credenciais válidas redireciona para o dashboard.
3. Login com credenciais inválidas exibe mensagem de erro.
4. Acesso sem autenticação exibe a tela de login.
5. Logout limpa a sessão e retorna para a tela de login.

### `tests/onboarding.spec.ts` — Onboarding

1. Usuário autenticado sem família vê a tela de onboarding.
2. Criar família avança para as configurações da família.
3. Modo "Entrar com convite" exibe o campo de código de convite.
4. Modo "Buscar e solicitar" exibe o campo de busca por família.
5. Código de convite inválido exibe mensagem de erro.
6. Após criar família, o dashboard apresenta estado inicial zerado (verifica `familiaIdAtiva` no `localStorage`).

### `tests/transacoes.spec.ts` — Transações

1. Criar receita simples — aparece no extrato.
2. Criar despesa simples e verificar via API (sem UI de confirmação).
3. Criar transação parcelada em 3x — gera 3 parcelas (verificado via API).
4. Criar transação recorrente mensal — badge "Recorrente" exibido no extrato.
5. Editar transação — valor atualizado no extrato (edição feita via API por ausência de botão na UI; resultado verificado via UI).
6. Excluir transação — removida do extrato (exclusão feita via API; ausência verificada via UI).

### `tests/familia.spec.ts` — Família

1. Criar família via onboarding avança para as configurações da família.
2. Gerar código de convite — código exibido na tela.
3. Segundo usuário entra via código de convite (fluxo API-only para o usuário 2; cleanup automático).
4. Aprovar solicitação de entrada — membro aparece na lista (aprovação via UI do admin).
5. Remover membro — removido da lista de membros (confirmado via API).

### `tests/orcamento.spec.ts` — Orçamento

1. Definir limite por categoria — salva com sucesso via UI.
2. Despesas que ultrapassam o limite — barra de progresso exibe classe CSS de perigo (`bg-danger`).
3. Dashboard mostra o progresso do orçamento configurado.

### `tests/relatorios.spec.ts` — Relatórios e Histórico

1. Relatório de distribuição por categoria — canvas do gráfico Doughnut renderizado.
2. Relatório por membro — dados do usuário autenticado exibidos na aba "Por Membro".
3. Fatura do cartão — transações do mês exibidas (ou estado vazio, ambos válidos).
4. Histórico de meses — lista de resumos mensais ou estado vazio; clicar em um mês abre o modal de detalhe.

---

## 5. Fixtures e helpers

### `helpers/api-client.ts`

Cliente HTTP baseado na API `fetch` nativa do Node.js. Não usa o navegador Playwright — é executado diretamente no processo de teste (Node.js). Responsável por:

- `register(data)` — `POST /auth/register`
- `login(data)` — `POST /auth/login`
- `criarFamilia(token, data)` — `POST /familias`
- `criarCategoria(token, familiaId, data)` — `POST /categorias`
- `criarMetodoPagamento(token, familiaId, data)` — `POST /metodos-pagamento`
- `criarTransacao(token, familiaId, data)` — `POST /transacoes`
- `deleteAccount(token)` — `DELETE /auth/account`

Rotas com escopo de família enviam o header `x-familia-id` automaticamente.

### `fixtures/base.ts`

Estende o `test` do Playwright com três fixtures reutilizáveis:

| Fixture             | O que faz                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authContext`       | Cria um usuário único via API, faz login e expõe `{ accessToken, refreshToken, user }`. Deleta a conta após o teste.                                                    |
| `familiaId`         | Cria uma família `"Família E2E"` para o usuário do `authContext`. Expõe o UUID da família.                                                                              |
| `authenticatedPage` | Retorna um `Page` do Playwright com os tokens já injetados no `localStorage` (`nossagrana.auth.session`), simulando um usuário já logado sem passar pela tela de login. |

O helper `uniqueEmail()` gera endereços no formato `test+<timestamp>+<random>@e2e.com` para garantir unicidade entre execuções paralelas.

### `fixtures/db.ts`

Arquivo placeholder. Acesso direto ao banco de dados a partir dos testes não está implementado. Caso seja necessário no futuro (por exemplo, para seed de grandes volumes de dados ou verificação de estado persistido sem passar pela API), este arquivo deve exportar fixtures que conectam ao PostgreSQL via `postgres.js` ou `pg`.

---

## 6. Endpoint `DELETE /auth/account`

Um endpoint dedicado foi criado na API exclusivamente para suportar o cleanup dos testes E2E.

**Rota:** `DELETE /auth/account`
**Autenticação:** JWT obrigatório (`preHandler: [fastify.authenticate]`)
**Resposta:** `204 No Content`

O endpoint deleta o usuário autenticado (identificado pelo `sub` do JWT) e, por cascata do banco de dados, remove todos os dados associados: família (se for o único membro), transações, categorias, métodos de pagamento e tokens de refresh.

Isso elimina a necessidade de manter um endpoint de administração separado ou manipular o banco diretamente para limpar os dados gerados pelos testes.

---

## 7. Como rodar localmente

### Pré-requisitos

- Docker em execução
- Banco de desenvolvimento da API rodando na porta `5432` (para separar do banco E2E)
- API e Web em execução (`pnpm dev` na raiz)

### Passos

```bash
# 1. Subir o banco E2E isolado (porta 5433)
pnpm --filter e2e setup:db

# 2. Copiar e preencher as variáveis de ambiente
cp apps/e2e/.env.e2e.example apps/e2e/.env

# 3. Rodar as migrations no banco E2E
DATABASE_URL=postgresql://nossagrana_e2e:nossagrana_e2e@localhost:5433/nossagrana_e2e \
  pnpm --filter api db:migrate

# 4. Garantir que a API está apontando para o banco E2E
# (editar apps/api/.env ou exportar DATABASE_URL antes de iniciar a API)

# 5. Executar os testes em modo headless
pnpm --filter e2e test

# 6. Executar com UI interativa do Playwright
pnpm --filter e2e test:ui

# 7. Executar com navegador visível
pnpm --filter e2e test:headed

# 8. Executar em modo debug (passo a passo)
pnpm --filter e2e test:debug
```

O relatório HTML é gerado em `apps/e2e/playwright-report/` e pode ser aberto com `npx playwright show-report`.

---

## 8. Como funciona no CI

O workflow está em `.github/workflows/e2e.yml` e é acionado em todo `push` para `main`.

### Sequência de execução

```
1. Checkout
2. Setup pnpm + Node.js 22
3. pnpm install
4. [service] PostgreSQL 16 sobe em 5433 (health check automático)
5. pnpm --filter api db:migrate (DATABASE_URL aponta para 5433)
6. pnpm --filter api build
7. pnpm --filter web build (VITE_API_URL=http://localhost:3000)
8. playwright install chromium --with-deps
9. node apps/api/dist/server.js & (background, porta 3000)
10. pnpm --filter web preview --port 5173 & (background)
11. wait-on http://localhost:3000/health http://localhost:5173 (timeout 60s)
12. pnpm --filter e2e test (CI=true → 2 retries automáticos)
13. Upload do relatório Playwright como artefato (30 dias de retenção)
```

O artefato `playwright-report` contém screenshots e vídeos de testes que falharam, facilitando o diagnóstico sem precisar reproduzir localmente.

---

## 9. Decisões técnicas

### Por que Playwright?

- Suporte nativo a TypeScript sem configuração adicional.
- API `page.evaluate()` simplifica a injeção de sessão no `localStorage`, padrão necessário para o NossaGrana (SPA sem rotas de URL).
- `page.request` permite chamar a API REST dentro dos testes sem dependência de bibliotecas externas.
- Fixtures com `base.extend<>()` permitem compartilhar estado (tokens, familia ID) entre testes de forma tipada e com cleanup automático.
- Relatórios HTML, screenshots e vídeos embutidos no reporter.

### Por que apenas Chromium?

O NossaGrana é uma PWA self-hosted voltada para uso em um único navegador (Chrome no Raspberry Pi ou em dispositivos da família). Cobrir Firefox e Safari adicionaria tempo de CI sem benefício real para este caso de uso específico. A decisão pode ser revisada se o escopo de uso mudar.

### Por que banco separado na porta 5433?

Isolar o banco E2E evita dois problemas:

1. **Contaminação:** os dados de seed e cleanup dos testes não aparecem no banco de desenvolvimento local.
2. **Paralelismo seguro:** o CI pode rodar os testes sem interferir em outras pipelines que eventualmente usem a porta padrão `5432`.

### Por que o cleanup usa `DELETE /auth/account` e não truncate direto?

Acessar o banco diretamente a partir dos testes exigiria expor a `DATABASE_URL` nas variáveis de ambiente dos testes E2E e importar um cliente PostgreSQL como dependência. O endpoint REST é mais simples, testa implicitamente a lógica de exclusão da API, e mantém os testes desacoplados do schema do banco.

---

## 10. Limitações conhecidas

### Seletores potencialmente frágeis

Vários testes dependem de seletores que assumem textos ou estrutura de componentes específicos da UI atual:

- `page.getByRole('heading', { name: 'NossaGrana' })` — se o título do dashboard mudar, quebra.
- `page.locator('.rounded-xl').filter({ hasText: 'ORÇAMENTO' })` — depende de classe CSS Tailwind.
- `page.locator('div.h-2.rounded-full').nth(1)` — posição relativa dentro de um card.
- O botão de remoção de membro usa o UUID do usuário como parte do `name`: `Remover <userId>`.

Esses seletores devem ser revisados e, idealmente, substituídos por atributos `data-testid` nas telas correspondentes.

### Testes que usam a API diretamente por ausência de UI

Três cenários em `transacoes.spec.ts` — editar transação, excluir transação e verificar parcelas — chamam a API REST diretamente via `page.request` porque a UI do extrato ainda não expõe botões de edição ou exclusão (o `TransacaoDetalheModal` é read-only na implementação atual). Esses testes perdem valor de E2E real e devem ser atualizados quando a UI for completada.

### Testes com múltiplos usuários (família.spec.ts)

Os testes que envolvem um segundo usuário (convite, solicitação, remoção) criam e deletam o segundo usuário dentro do próprio teste. Se o teste falhar antes do bloco `finally`, o segundo usuário pode permanecer no banco E2E e acumular ao longo de execuções repetidas.

### Sem verificação de conteúdo de canvas

Os testes de relatórios apenas verificam que o elemento `<canvas>` está visível — não o conteúdo do gráfico renderizado. Isso é intencional (pixel testing seria frágil e lento), mas significa que um bug no cálculo dos dados do gráfico pode não ser detectado pelos E2E.
