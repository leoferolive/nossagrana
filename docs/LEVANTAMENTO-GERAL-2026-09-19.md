# Levantamento geral de melhorias e evolução — NossaGrana

> Data: 19/09/2026
>
> Escopo: backend, frontend, segurança, integridade financeira, UX, acessibilidade, PWA, banco, CI/CD, Kubernetes, observabilidade, operação e evolução de produto.
> Método: inspeção estática do código e da documentação, três auditorias independentes em paralelo e execução parcial do quality gate. Nenhuma aplicação, migration ou deploy foi alterado.

## 1. Resumo executivo

O NossaGrana já possui uma base ampla: os principais módulos financeiros estão implementados, o isolamento por família foi centralizado, existem testes unitários e E2E, a API usa validação tipada, o deploy é multi-arquitetura e a CI possui controles relevantes de supply chain. O produto já cobre um ciclo financeiro familiar considerável.

Os riscos mais importantes não são falta de telas, mas confiabilidade operacional e integridade:

1. Não há estratégia versionada de backup e restauração do PostgreSQL. Uma falha de armazenamento pode causar perda irreversível dos dados financeiros.
2. Operações financeiras compostas — especialmente cofrinhos, parcelas, recorrências e aplicação de templates — não são integralmente atômicas.
3. Há condições de corrida em convites e snapshots mensais.
4. IDs relacionados podem, em alguns fluxos, referenciar recursos de outra família sem validação explícita de posse.
5. Access e refresh tokens ficam no `localStorage`, e o access token do WebSocket é enviado na URL.
6. Há divergências relevantes entre PRD/casos de uso e a implementação: mês fechado, antecipação, edição de recorrências, histórico de orçamento, insights e exclusão de família no frontend.
7. A CI não executa testes do frontend nem E2E, e o PWA ainda não tem comportamento offline definido e testado.

### Prioridade recomendada

| Horizonte     | Objetivo                   | Itens centrais                                                                                                     |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Imediato      | Proteger dados             | Backup/restore, atomicidade de cofrinhos, referências cross-tenant, snapshots únicos                               |
| Próximo ciclo | Fechar riscos de segurança | Sessões em cookies, ticket WS, família soft-deleted, revogação ao trocar senha, `trustProxy`                       |
| 1–2 ciclos    | Aderência funcional e UX   | Mês fechado, recorrências, antecipação, erros de mutação, acessibilidade de modais e tabelas                       |
| Evolução      | Escala e produto           | Paginação, índices medidos, offline definido, insights acionáveis, exportação/importação e planejamento financeiro |

## 2. Convenções

- **P0:** risco imediato de perda ampla de dados ou indisponibilidade crítica.
- **P1:** segurança, integridade financeira ou fluxo essencial.
- **P2:** melhoria importante de qualidade, performance, operação ou experiência.
- **P3:** evolução opcional, refinamento ou oportunidade futura.
- **Esforço S/M/L:** pequeno, médio ou grande; é uma estimativa relativa, não um prazo.
- **Confirmado:** evidência direta no código ou documentação.
- **Hipótese:** exige teste em ambiente real, carga, navegador ou topologia de produção.

## 3. Correções de segurança e privacidade

### SEC-01 — Validar a família ativa, não apenas o vínculo

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/api/src/plugins/familia-scope.plugin.ts:34-49`; soft delete em `apps/api/src/modules/familia/familia.repository.ts:311-317`.
- **Problema:** `requireFamiliaScope` valida a associação do usuário, mas não verifica `familias.deleted_at`. Uma família excluída pode continuar acessível por membros que conservem o ID.
- **Ação:** fazer join com `familias`, exigir `deleted_at IS NULL`, invalidar convites e encerrar conexões WebSocket ao excluir a família.
- **Teste necessário:** família A ativa, família B excluída e usuário ainda associado; todas as rotas financeiras e WS devem negar B.

### SEC-02 — Impedir referências cruzadas entre famílias

- **Status:** confirmado
- **Prioridade / esforço:** P1 / L
- **Evidência:** inserção em `apps/api/src/modules/transacao/transacao.repository.ts:69-94`; rotas em `apps/api/src/modules/transacao/transacao.routes.ts:93-103`; templates em `apps/api/src/modules/template-transacao/template-transacao.repository.ts:185-215`; orçamento em `apps/api/src/modules/orcamento/orcamento.routes.ts:50-64`.
- **Problema:** IDs de categoria, método de pagamento, cofrinho e outros relacionamentos podem ser aceitos sem comprovar que pertencem à mesma `familia_id`.
- **Impacto:** corrupção lógica e possível exposição indireta de dados por joins ou respostas enriquecidas.
- **Ação:** validar posse e status ativo de cada referência no service/repository; considerar chaves/constraints compostas onde forem viáveis.
- **Teste necessário:** tentar criar e editar cada entidade de A usando IDs pertencentes a B.

### SEC-03 — Migrar tokens do `localStorage` para cookies seguros

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M–L
- **Evidência:** `apps/web/src/contexts/auth-context.tsx:13-50,85-119`; `apps/web/src/services/core-financeiro.service.ts:327-350`.
- **Problema:** qualquer XSS com execução no origin pode exfiltrar access e refresh tokens.
- **Ação:** manter refresh token em cookie `HttpOnly`, `Secure` e `SameSite`; manter access token em memória ou também em cookie conforme a estratégia de CSRF; rotacionar tokens e documentar ameaça/mitigação.
- **Dependência:** revisar CORS, CSRF e fluxo de refresh antes da migração.

### SEC-04 — Remover JWT da URL do WebSocket

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** cliente em `apps/web/src/stores/websocket.store.ts:54-55`; servidor em `apps/api/src/modules/ws/ws.routes.ts:10-27`.
- **Problema:** query strings podem aparecer em logs de proxy, ferramentas de diagnóstico e telemetria.
- **Ação:** usar cookie seguro, subprotocol apropriado ou ticket efêmero e de uso único emitido por endpoint autenticado; redigir URLs em logs.
- **Complemento:** rastrear usuário por socket e fechar conexões quando membership ou sessão forem revogados.

### SEC-05 — Revogar sessões após troca normal de senha

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/api/src/modules/auth/auth.routes.ts:298-308`; o reset já revoga em `apps/api/src/modules/auth/password-reset.service.ts:49-54`.
- **Problema:** refresh tokens previamente roubados continuam utilizáveis após a troca de senha.
- **Ação:** revogar todos os refresh tokens do usuário e, se for requisito, adotar versão de sessão para invalidar access tokens ainda vivos.

### SEC-06 — Restringir `trustProxy`

- **Status:** hipótese dependente da topologia
- **Prioridade / esforço:** P1 / S
- **Evidência:** `trustProxy: true` em `apps/api/src/app.ts:19` e rate limit baseado em IP.
- **Risco:** se a API puder ser alcançada fora de um proxy confiável, `X-Forwarded-For` pode ser forjado para contornar limites.
- **Ação:** configurar quantidade/lista de proxies confiáveis e validar o caminho Cloudflare Tunnel/Tailscale/Traefik em produção.

### SEC-07 — Proteger métricas e confirmar terminação TLS

- **Status:** parcialmente confirmado
- **Prioridade / esforço:** P2 / S–M
- **Evidência:** métricas em `apps/api/src/plugins/metrics.plugin.ts:11-33`; não há autenticação de `/metrics` visível nos manifests; ingress usa entrypoint HTTP.
- **Ação:** expor métricas apenas à rede/namespace de monitoramento e confirmar que TLS termina exclusivamente em uma borda confiável sem acesso HTTP direto à API.

## 4. Integridade financeira e regras de negócio

### FIN-01 — Tornar movimentações de cofrinho atômicas

- **Status:** confirmado
- **Prioridade / esforço:** P1 / L
- **Evidência:** `apps/api/src/modules/cofrinho/cofrinho.service.ts:181-197,213-268`.
- **Problema:** leitura do saldo, validação, transação financeira, movimentação e atualização do saldo acontecem separadamente.
- **Impacto:** aportes podem perder atualizações; retiradas concorrentes podem exceder o saldo; falha intermediária pode deixar registros divergentes.
- **Ação:** transação PostgreSQL única, lock da linha ou update condicional atômico (`saldo >= valor`) e rollback completo.

### FIN-02 — Transacionar parcelas, recorrências e templates

- **Status:** confirmado
- **Prioridade / esforço:** P1 / L
- **Evidência:** `apps/api/src/modules/transacao/transacao.service.ts:79-126`; `apps/api/src/modules/template-transacao/template-transacao.service.ts:113-143`.
- **Problema:** operações multi-registro podem ficar parcialmente gravadas.
- **Ação:** criar boundary transacional explícito no repository e executar pai, filhas e efeitos derivados na mesma unidade.

### FIN-03 — Garantir snapshot único por família e mês

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/api/src/modules/historico/snapshot.service.ts:7-20`; índice não único em `apps/api/src/db/schema.ts:224-228`.
- **Problema:** o padrão “buscar e depois inserir” permite duplicidade concorrente.
- **Ação:** unique index `(familia_id, mes_referencia)` e insert idempotente com conflito tratado.

### FIN-04 — Tornar convite de uso único realmente atômico

- **Status:** confirmado
- **Prioridade / esforço:** P1 / S–M
- **Evidência:** `apps/api/src/modules/familia/familia.repository.ts:117-154`.
- **Problema:** dois usuários podem ler o convite como livre antes de um deles atualizar `usado_por`.
- **Ação:** `UPDATE ... WHERE usado_por IS NULL RETURNING` ou lock dentro de transação.

### FIN-05 — Alinhar edição/exclusão ao conceito de mês fechado

- **Status:** confirmado; divergência entre implementação e casos de uso
- **Prioridade / esforço:** P1 / L
- **Evidência:** implementação em `apps/api/src/modules/transacao/transacao.service.ts:238-276`; regra em `docs/USE_CASES.md:227-253`.
- **Problema:** o código marca snapshot como divergente, mas não bloqueia alterações quando o caso de uso exige bloqueio.
- **Decisão necessária:** escolher entre “mês imutável” e “mês editável com divergência auditável”; atualizar código, PRD e UX de forma coerente.

### FIN-06 — Implementar antecipação e edição de recorrência completas

- **Status:** confirmado
- **Prioridade / esforço:** P1 / L
- **Evidência:** antecipação atual em `apps/api/src/modules/transacao/transacao.service.ts:278-293`; comportamento esperado em `docs/USE_CASES.md:215-232,261-274`; UI em `apps/web/src/components/transacao-modal.tsx:293-331`.
- **Problema:** antecipação apenas move `mesReferencia`; não há fluxo “só esta”/“esta e futuras” na edição.
- **Ação:** modelar comandos explícitos, validar efeitos contábeis e criar testes de série completa.

### FIN-07 — Ajustar validação monetária à precisão do banco

- **Status:** confirmado
- **Prioridade / esforço:** P2 / S
- **Evidência:** `packages/types/src/index.ts:397-413,850-873`; colunas numéricas em `apps/api/src/db/schema.ts:151`.
- **Problema:** schemas aceitam zero e quantidade de dígitos incompatível com `numeric(14,2)`/`numeric(12,2)`.
- **Ação:** validar positividade, escala, precisão e coerência entre flags de parcelamento/recorrência.

## 5. Bugs e melhorias de frontend/UX

### UX-01 — Só fechar modais financeiros após sucesso

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/web/src/components/transacao-modal.tsx:127-155`; chamada em `apps/web/src/App.tsx:430-435`; `apps/web/src/components/cofrinho-modal.tsx:40-49`.
- **Problema:** o modal fecha antes da conclusão da API, ocultando falhas e incentivando duplicidade.
- **Ação:** estado `saving`, bloqueio de duplo submit, erro inline/toast com `aria-live` e fechamento somente após confirmação.

### UX-02 — Não transformar erro de extrato em lista vazia

- **Status:** confirmado
- **Prioridade / esforço:** P1 / S
- **Evidência:** `apps/web/src/pages/extrato-page.tsx:125-134`.
- **Ação:** preservar dados anteriores, distinguir erro de vazio e oferecer retry.

### UX-03 — Corrigir data padrão baseada em UTC

- **Status:** confirmado
- **Prioridade / esforço:** P1 / S
- **Evidência:** `apps/web/src/components/transacao-modal.tsx:40` usa `toISOString()`.
- **Impacto:** próximo da meia-noite, o dia pode ser anterior no fuso de São Paulo.
- **Ação:** construir data local explicitamente e testar viradas de dia/mês/ano e horário de verão histórico.

### UX-04 — Tratar erros de perfil, métodos e histórico

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/web/src/pages/perfil-page.tsx:22-40`; `apps/web/src/pages/metodos-pagamento-page.tsx:61-105`; `apps/web/src/pages/historico-page.tsx:75-84`.
- **Problema:** falhas são silenciadas ou podem deixar spinner sem explicação.
- **Ação:** estados independentes para loading/save/error, mensagens acionáveis e retry.

### UX-05 — Corrigir token visual inexistente

- **Status:** confirmado
- **Prioridade / esforço:** P1 / S
- **Evidência:** `text-error` em `apps/web/src/pages/login-page.tsx:81` e `sign-up-page.tsx:110`; tema em `apps/web/tailwind.config.ts:7-23`.
- **Ação:** usar `text-danger` e adicionar uma checagem visual/DOM para mensagens de erro.

### UX-06 — Completar filtros e paginação do extrato

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M–L
- **Evidência:** filtros locais em `apps/web/src/pages/extrato-page.tsx:94-150,250-297`; requisitos em `docs/PRD.md:142-146`; API sem paginação em `apps/api/src/modules/transacao/transacao.routes.ts:116-138`.
- **Ação:** filtros por mês, membro, categoria, tipo e método; busca textual; parâmetros refletidos na URL; paginação server-side com limite máximo.

### UX-07 — Exigir confirmação em ações destrutivas

- **Status:** confirmado
- **Prioridade / esforço:** P1 / S
- **Evidência:** remoção direta de membro em `apps/web/src/pages/family-settings-page.tsx:118-128`.
- **Ação:** confirmação com nome do membro, feedback e proteção contra remover o último admin.

### UX-08 — Tornar tours específicos por usuário

- **Status:** confirmado
- **Prioridade / esforço:** P2 / S
- **Evidência:** chave global em `apps/web/src/components/first-time-tour.tsx:14-18`; reset incompleto em `apps/web/src/pages/ajuda-page.tsx:100-108`.
- **Ação:** chavear por usuário/tela/versão do tour e incluir Cofrinhos no reset.

## 6. Acessibilidade e design inclusivo

### A11Y-01 — Tornar linhas clicáveis operáveis por teclado

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `<li onClick>` e `<tr onClick>` em `apps/web/src/pages/extrato-page.tsx:310-318,359-366`; histórico em `apps/web/src/pages/historico-page.tsx:243-248`.
- **Ação:** usar links/botões semânticos; se uma linha inteira for interativa, garantir foco, Enter/Espaço e nome acessível.

### A11Y-02 — Implementar comportamento correto de modal

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/web/src/components/transacao-modal.tsx:160-186`; `cofrinho-modal.tsx:56-81`; modal histórico em `historico-page.tsx:304-321`.
- **Ação:** `aria-labelledby`, foco inicial, focus trap, Escape, restauração do foco e bloqueio do conteúdo atrás do modal.

### A11Y-03 — Corrigir semântica do `CustomSelect`

- **Status:** confirmado
- **Prioridade / esforço:** P2 / M
- **Evidência:** opções com `<li onClick>` em `apps/web/src/components/custom-select.tsx:111-134`.
- **Ação:** preferir controles nativos estilizados ou implementar integralmente o padrão combobox/listbox com teclado.

### A11Y-04 — Anunciar estados assíncronos e respeitar reduced motion

- **Status:** confirmado
- **Prioridade / esforço:** P2 / S–M
- **Evidência:** loadings sem live region em `dashboard-page.tsx:95-99` e `categorias-page.tsx:167`; animações em `first-time-tour.tsx:65`, `budget-bar.tsx:31` e `voice-recording-sheet.tsx:85`.
- **Ação:** `role="status"`, `aria-live`, foco em erros relevantes e variantes `motion-reduce`.

### A11Y-05 — Validar layout em 320–360 px

- **Status:** hipótese
- **Prioridade / esforço:** P2 / M
- **Evidência:** três cards fixos em `apps/web/src/pages/dashboard-page.tsx:165-190`; possível sobreposição entre FAB e bottom nav.
- **Ação:** matriz visual de viewports, valores monetários longos e safe areas reais de iOS/Android.

## 7. Infraestrutura, resiliência e observabilidade

### OPS-01 — Implantar backup e restore testado

- **Status:** confirmado
- **Prioridade / esforço:** P0 / L
- **Evidência:** `k8s/postgres/statefulset.yaml:36-43` possui apenas PVC; `k8s/postgres/README.md:3-20` não define backup/restore.
- **Ação recomendada:**
  1. Definir RPO/RTO.
  2. Agendar `pg_dump` ou solução física compatível com o volume.
  3. Copiar para armazenamento externo ao Raspberry Pi, com criptografia, checksum e retenção.
  4. Alertar falhas e espaço disponível.
  5. Executar restauração automatizada periódica em banco descartável.
- **Critério de aceite:** recuperar uma cópia validada e registrar duração, data e integridade.

### OPS-02 — Separar liveness de readiness

- **Status:** confirmado
- **Prioridade / esforço:** P1 / S
- **Evidência:** health sempre “ok” em `apps/api/src/modules/health/health.routes.ts:5-12`; probes em `k8s/prod/api-deployment.yaml:36-47`.
- **Ação:** `/health/live` verifica processo; `/health/ready` verifica conexão com PostgreSQL e estado mínimo de inicialização/migrations.

### OPS-03 — Tirar jobs agendados do ciclo de cada pod

- **Status:** confirmado
- **Prioridade / esforço:** P1 / L
- **Evidência:** jobs iniciados em `apps/api/src/server.ts:22-23`; snapshot em `snapshot.job.ts:35-47`.
- **Problema:** escalar a API duplica execução; falhas não têm retry/alerta suficiente.
- **Ação:** Kubernetes CronJob ou lock distribuído/advisory lock, idempotência, métrica de última execução e reprocessamento.

### OPS-04 — Não processar famílias excluídas e observar falhas de snapshot

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `apps/api/src/modules/historico/snapshot.job.ts:23-32` busca todas e usa `Promise.allSettled` sem reportar rejeições.
- **Ação:** filtrar ativas, log estruturado por família, retry idempotente e alerta quando o mês não fechar.

### OPS-05 — Controlar migrations fora do startup da API

- **Status:** confirmado
- **Prioridade / esforço:** P2 / L
- **Evidência:** `apps/api/src/server.ts:7-13`; migration destrutiva em `apps/api/src/db/migrations/0006_careless_terror.sql:1-3`.
- **Risco:** migration defeituosa causa crash loop e amplia o impacto do deploy.
- **Ação:** Job de migration com lock, backup/check prévio, logs, timeout e plano de rollback/roll-forward.

### OPS-06 — Completar observabilidade

- **Status:** confirmado
- **Prioridade / esforço:** P2 / M
- **Evidência:** métricas HTTP existem, mas não há ServiceMonitor/alertas; há `console.log/error` em `server.ts`, `db/migrate.ts` e `revoked-token-cleanup.job.ts`.
- **Ação:** logs JSON estruturados, métricas de DB/jobs/auth/WS, dashboards e alertas de erro, latência, espaço, backup e snapshot atrasado.

### OPS-07 — Definir disponibilidade compatível com o Raspberry Pi

- **Status:** hipótese/decisão arquitetural
- **Prioridade / esforço:** P3 / L
- **Evidência:** API, Web e PostgreSQL usam uma réplica em um único nó.
- **Ação:** documentar a indisponibilidade esperada; se necessário, priorizar recuperação rápida e backup externo antes de alta disponibilidade complexa.

## 8. Performance e escalabilidade

### PERF-01 — Paginação server-side padronizada

- **Status:** confirmado
- **Prioridade / esforço:** P2 / M
- **Evidência:** `GET /transacoes` retorna coleção sem `page`/`limit`; padrão repetido em cofrinhos, templates e histórico. A regra está em `.claude/rules/api-design.md:52-58`.
- **Ação:** cursor ou página/limite, teto de 100, ordenação estável e `meta.total/page`.

### PERF-02 — Medir e criar índices compostos úteis

- **Status:** hipótese fundamentada; requer medição
- **Prioridade / esforço:** P2 / M
- **Evidência:** dashboard filtra `familia_id` + `mes_referencia` em `apps/api/src/modules/dashboard/dashboard.repository.ts:166-172`; schema tem índices separados em `apps/api/src/db/schema.ts:175-181`.
- **Ação:** usar `EXPLAIN (ANALYZE, BUFFERS)` com volume representativo e considerar `(familia_id, mes_referencia)` e índices parciais para ativos.

### PERF-03 — Evitar hashing síncrono no event loop

- **Status:** confirmado como divergência técnica
- **Prioridade / esforço:** P2 / M
- **Evidência:** `scryptSync` em `apps/api/src/modules/auth/auth.service.ts:32-51`; documentação ainda define bcrypt em `docs/DECISIONS.md:177-181`.
- **Ação:** decidir e registrar bcrypt/Argon2/scrypt; usar API assíncrona e benchmark adequado ao Raspberry Pi.

## 9. Qualidade, testes, CI e DX

### QA-01 — Reativar testes Web e adicionar E2E na CI

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** job Web desabilitado em `.github/workflows/ci.yml:133-136`; não há job Playwright; service workers são bloqueados em `apps/e2e/playwright.config.ts:14`.
- **Ação:** executar testes Web em Linux, subir Postgres/API/Web para Playwright e criar projeto específico para PWA/offline.

### QA-02 — Testar caminhos de produção do escopo multi-tenant

- **Status:** confirmado
- **Prioridade / esforço:** P1 / M
- **Evidência:** `familia-scope.plugin.ts` e `ws.routes.ts` pulam membership em `NODE_ENV=test`.
- **Problema:** integração não exercita exatamente a autorização usada em produção.
- **Ação:** banco isolado de teste ou injeção de verifier fake sem bypass global; cenários com duas famílias em todas as referências.

### QA-03 — Adicionar testes de concorrência e rollback

- **Status:** confirmado
- **Prioridade / esforço:** P1 / L
- **Cobertura alvo:** convite, snapshot, cofrinho, geração de parcelas/recorrências, templates e reset/reuso de token.
- **Critério:** provar unicidade, saldo não negativo, ausência de estado parcial e idempotência.

### QA-04 — Cobrir acessibilidade e estados de erro

- **Status:** confirmado
- **Prioridade / esforço:** P2 / M
- **Lacunas:** `familia-selector-page`, bottom nav, top bar, month nav, gráficos, modais de cofrinho, foco/Escape, retry e erros de mutação.
- **Ação:** Testing Library + axe onde fizer sentido e poucos E2E críticos com teclado.

### QA-05 — Corrigir reprodutibilidade local das dependências

- **Status:** confirmado no ambiente auditado
- **Prioridade / esforço:** P2 / S
- **Evidência:** `pnpm quality` parou porque `eslint-plugin-sonarjs` não estava instalado localmente; testes API também encontraram ausência de `fastify-metrics`, ambos declarados no manifesto/lockfile.
- **Ação:** validar instalação limpa com `pnpm install --frozen-lockfile`, evitar cache/node_modules de outro worktree e documentar diagnóstico.
- **Nota:** isso não prova falha da CI; indica drift da instalação local.

### QA-06 — Padronizar versão do pnpm

- **Status:** confirmado
- **Prioridade / esforço:** P2 / S
- **Evidência:** `package.json` define pnpm `10.34.4`, enquanto `README.md:45-49,128-131` ainda orienta `9.15.0`.
- **Ação:** adotar Corepack com uma única versão e validar no bootstrap/CI.

### QA-07 — Padronizar contrato de erro da API

- **Status:** confirmado
- **Prioridade / esforço:** P2 / M
- **Evidência:** regra exige `{ error: { message, code? } }` em `.claude/rules/api-design.md:9-20`; handlers retornam também `{ message }`, por exemplo `apps/api/src/plugins/auth.plugin.ts:37-42`.
- **Ação:** error handler central, schemas de resposta e cliente tipado; ou decisão documentada alterando o contrato.

### QA-08 — Validar encerramento da suíte Web

- **Status:** confirmado no ambiente auditado
- **Prioridade / esforço:** P2 / S–M
- **Problema:** os testes Web executaram, mas o processo não encerrou no tempo observado.
- **Ação:** localizar timers, listeners, WebSocket mocks ou handles abertos e tornar a suíte determinística.

### QA-09 — Reduzir dívida de complexidade sinalizada pelo lint

- **Status:** confirmado
- **Prioridade / esforço:** P2 / L, de forma incremental
- **Evidência:** o ESLint atual reporta 36 warnings na API, 63 no Web e 2 em `packages/types`, principalmente funções extensas, complexidade e arquivos acima do limite.
- **Pontos de maior risco:** `transacao.service.ts`, `App.tsx`, `dashboard-page.tsx`, `transacao-modal.tsx`, `historico-page.tsx` e `orcamento-page.tsx`.
- **Ação:** não fazer um rewrite amplo; extrair módulos durante mudanças funcionais, priorizando regras financeiras e componentes com muitos estados. Manter o ratchet para impedir crescimento.

## 10. Features já previstas, mas incompletas

### FEAT-01 — Histórico de orçamento por categoria

- **Prioridade / esforço:** P2 / M
- **Evidência:** serviço existe em `apps/web/src/services/core-financeiro.service.ts:234-241`, mas `orcamento-page.tsx:53-60` não o apresenta.
- **Entrega:** timeline de vigências, autor/data, comparação e estados vazio/erro.

### FEAT-02 — Insights financeiros acionáveis

- **Prioridade / esforço:** P1 / M–L
- **Evidência:** relatórios mostram gráficos em `relatorios-page.tsx:198-220`; PRD pede insights em `docs/PRD.md:164-169`.
- **Entrega:** regras transparentes, como “alimentação subiu 18%”, “assinaturas recorrentes representam X%” e “orçamento pode estourar em N dias”, sempre explicando cálculo e período.

### FEAT-03 — Histórico mensal completo

- **Prioridade / esforço:** P1 / M
- **Evidência:** `historico-page.tsx:392-406` exibe categorias, mas o DTO já contém `dadosUsuarios` em `packages/types/src/index.ts:692-707`.
- **Entrega:** breakdown por membro, snapshot versus atual, divergências e exportação.

### FEAT-04 — Exclusão de família no frontend

- **Prioridade / esforço:** P1 / M
- **Evidência:** `family-settings-page.tsx:93-201` não oferece o fluxo; caso de uso em `docs/USE_CASES.md:486-500`.
- **Entrega:** confirmação forte digitando o nome, explicação do soft delete, encerramento de sessão/contexto e caminho de recuperação administrativa.

### FEAT-05 — Aportes recorrentes em cofrinhos

- **Prioridade / esforço:** P2 / M
- **Evidência:** FAQ promete recorrência em `ajuda-page.tsx:92-95`, mas a UI envia `recorrente: false` em `cofrinho-detalhe-page.tsx:48-50`.
- **Decisão:** implementar frequência/data final ou remover a promessa da documentação.

### FEAT-06 — PWA offline com escopo explícito

- **Prioridade / esforço:** P2 / M–L
- **Evidência:** `apps/web/vite.config.ts:19-48` precacheia assets, mas não define runtime cache ou fila; `docs/TASKS.md` ainda marca o teste offline como pendente.
- **Opção recomendada inicial:** offline read-only para últimos dados sincronizados, banner claro e bloqueio seguro de mutações. Sincronização de escrita pode vir depois, com idempotency keys e resolução de conflito.

## 11. Novas oportunidades de produto

As ideias abaixo são propostas de evolução; não são bugs nem requisitos já assumidos.

### PROD-01 — Centro de contas e patrimônio

- **Prioridade sugerida / esforço:** P2 / L
- **Valor:** separar saldo de conta, dinheiro, investimentos e cartões; oferecer visão patrimonial além do fluxo mensal.
- **Pré-requisito:** decidir se “método de pagamento” evolui para conta financeira ou se nasce um agregado separado.

### PROD-02 — Conciliação e importação de extratos

- **Prioridade sugerida / esforço:** P2 / L
- **Valor:** importar OFX/CSV, detectar duplicidades e reconciliar lançamentos pendentes.
- **Cuidados:** parser isolado, preview, idempotência, regras por banco e proteção de dados sensíveis.

### PROD-03 — Exportação e portabilidade

- **Prioridade sugerida / esforço:** P2 / M
- **Valor:** CSV/JSON para transparência, backup pessoal e análise externa; PDF para relatórios mensais.
- **Segurança:** autorização por família, registro de exportação e arquivo temporário com expiração.

### PROD-04 — Planejamento de fluxo de caixa

- **Prioridade sugerida / esforço:** P2 / L
- **Valor:** projeção de saldo usando recorrências, parcelas, faturas e receitas previstas; alertas de saldo negativo futuro.

### PROD-05 — Regras de categorização automática

- **Prioridade sugerida / esforço:** P3 / M
- **Valor:** sugerir categoria por descrição/comerciante e permitir regras locais da família.
- **Abordagem:** começar determinístico e explicável; IA opcional somente depois, preservando privacidade.

### PROD-06 — Aprovação e responsabilidades familiares

- **Prioridade sugerida / esforço:** P3 / L
- **Valor:** papéis mais granulares, aprovação de gastos acima de limite e trilha de auditoria para famílias que precisam de controle compartilhado.

### PROD-07 — Metas e alertas proativos

- **Prioridade sugerida / esforço:** P2 / M
- **Valor:** avisos de orçamento próximo do limite, fatura próxima, recorrência incomum e progresso de cofrinho.
- **Canal inicial:** notificações in-app; push PWA apenas após consentimento e estratégia de entrega confiável.

### PROD-08 — Auditoria de alterações

- **Prioridade sugerida / esforço:** P2 / L
- **Valor:** mostrar quem criou, alterou ou excluiu um lançamento e quais campos mudaram, especialmente útil em família multiusuário.
- **Relação:** fortalece a decisão sobre divergência de snapshots e mês fechado.

## 12. Sequenciamento sugerido

### Ciclo 1 — Segurança dos dados

1. Backup externo + restore testado.
2. Unique snapshot e consumo atômico de convite.
3. Transações/locks em cofrinhos.
4. Validação de todas as referências por `familia_id`.
5. Família soft-deleted bloqueada em HTTP e WS.

### Ciclo 2 — Sessão e autorização

1. Revogação após troca de senha.
2. Ticket/cookie para WebSocket.
3. Estratégia de cookies e proteção CSRF.
4. `trustProxy`, TLS e `/metrics` validados na topologia real.
5. Testes multi-tenant sem bypass de produção.

### Ciclo 3 — Integridade funcional

1. Decisão e implementação de mês fechado.
2. Parcelas/recorrências/templates transacionais.
3. Antecipação e edição “esta/futuras”.
4. Validação monetária e contrato uniforme de erros.

### Ciclo 4 — Experiência confiável

1. Erros e saving states nas mutações.
2. Acessibilidade de modais, tabelas e selects.
3. Filtros/paginação do extrato.
4. Histórico de orçamento, histórico mensal e exclusão de família.

### Ciclo 5 — Operação e evolução

1. Readiness real, jobs isolados e observabilidade.
2. Web/E2E/PWA na CI.
3. Offline read-only.
4. Insights acionáveis, exportação e planejamento de fluxo de caixa.

## 13. Pontos fortes a preservar

- Isolamento de família centralizado e aplicado na maior parte dos repositories.
- Access token curto, refresh token separado, rotação e detecção de reutilização.
- Rate limits específicos em rotas sensíveis, Helmet e CORS restrito.
- Uso amplo de Fastify, Zod, Drizzle e tipos compartilhados.
- Testes unitários de domínio, repositories InMemory e cenários multi-tenant já existentes.
- Imagens Docker multi-stage, execução sem root e suporte ARM64.
- Actions fixadas por SHA, Gitleaks, Semgrep, auditoria de dependências e validação tag↔ref.
- Design tokens semânticos e biblioteca de ícones majoritariamente consistentes.
- Estrutura inicial sólida para PWA, WebSocket, relatórios, cofrinhos e administração.

## 14. Validação realizada e limitações

- Uma primeira execução de `pnpm quality` parou por dependências ausentes na instalação local. Após `pnpm install --frozen-lockfile`, lint rápido, ESLint e type-check concluíram; o lint registrou warnings de complexidade, sem erros.
- A suíte da API concluiu com **44 arquivos e 479 testes aprovados**, cobertura global de **89,06% em statements/linhas**.
- A suíte Web exibiu todos os arquivos executados como aprovados, mas não encerrou após mais de 60 segundos sem nova saída e precisou receber `SIGINT`; por isso o quality gate completo não pode ser considerado aprovado.
- Não foram executados migration real, restore, carga, deploy ou E2E completo.
- O documento `docs/AUDIT-UX.md` é de 19/03/2026 e deve ser tratado como histórico: vários itens podem já ter sido corrigidos; este levantamento só incorpora achados confirmados no código atual.
- Arquivos locais não relacionados e não rastreados foram preservados.

## 15. Próximo passo recomendado

Transformar os itens do **Ciclo 1** em tasks pequenas, cada uma com critério de aceite e teste TDD. Antes de começar feature nova, a primeira entrega deve ser **OPS-01 — backup externo com restauração comprovada**, pois é o único risco P0 e protege todo o valor já acumulado no produto.

## 16. Curadoria executiva — TOP 15

> Curadoria revisada em 19/09/2026. Foram avaliados impacto, urgência, probabilidade, capacidade de desbloquear outros trabalhos, esforço e dependências. A seleção favorece perda de dados, isolamento multi-tenant, consistência financeira e confiabilidade dos fluxos essenciais antes de features incrementais.

### Critérios de ordenação

1. **Dano potencial:** perda de dados, acesso indevido e corrupção financeira vêm primeiro.
2. **Exposição atual:** achados confirmados no código superam hipóteses dependentes de ambiente.
3. **Efeito multiplicador:** fundações que habilitam testes, escala e features recebem prioridade adicional.
4. **Ordem de dependência:** decisões de domínio e boundaries transacionais precedem UI e automação.
5. **Executabilidade:** cada issue possui escopo, alternativas, recomendação, critérios verificáveis e estratégia de testes.

### Ranking priorizado

| Rank | Issue                                                                                                                | Por que está no TOP 15                                                                      | Prioridade | Estrutura           |
| ---: | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------- | ------------------- |
|    1 | [#44 — Backup externo e restauração comprovada](https://github.com/leoferolive/nossagrana/issues/44)                 | Único risco capaz de eliminar todo o histórico financeiro em uma falha do Pi/SSD/PVC        | P0         | Epic + 4 sub-issues |
|    2 | [#54 — Bloquear referências cross-tenant](https://github.com/leoferolive/nossagrana/issues/54)                       | Fecha uma classe de corrupção e exposição indireta entre famílias                           | P1         | Epic + 4 sub-issues |
|    3 | [#59 — Garantir atomicidade de cofrinhos](https://github.com/leoferolive/nossagrana/issues/59)                       | Evita saldo negativo, lost update e registros financeiros parciais                          | P1         | Epic + 4 sub-issues |
|    4 | [#64 — Tornar parcelas, recorrências e templates atômicos](https://github.com/leoferolive/nossagrana/issues/64)      | Garante rollback de operações financeiras compostas                                         | P1         | Epic + 4 sub-issues |
|    5 | [#115 — Hardening de sessão e WebSocket](https://github.com/leoferolive/nossagrana/issues/115)                       | Remove tokens persistentes acessíveis por JavaScript e JWT em URL, além de fechar revogação | P1         | Epic + 5 sub-issues |
|    6 | [#46 — Ciclo de vida de família excluída e convites](https://github.com/leoferolive/nossagrana/issues/46)            | Impede acesso após soft delete e consumo concorrente de convite                             | P1         | Epic + 4 sub-issues |
|    7 | [#50 — Snapshots idempotentes e jobs resilientes](https://github.com/leoferolive/nossagrana/issues/50)               | Protege a imutabilidade mensal e remove execução duplicada/silenciosa de jobs               | P1         | Epic + 4 sub-issues |
|    8 | [#51 — Definir e implementar mês fechado, séries e antecipação](https://github.com/leoferolive/nossagrana/issues/51) | Resolve divergência central entre documentação, regras contábeis, API e UI                  | P1         | Epic + 5 sub-issues |
|    9 | [#52 — Exercitar autorização multi-tenant real nos testes](https://github.com/leoferolive/nossagrana/issues/52)      | Remove a falsa segurança causada pelo bypass de membership em testes                        | P1         | Epic + 4 sub-issues |
|   10 | [#53 — Reativar testes Web e E2E na CI](https://github.com/leoferolive/nossagrana/issues/53)                         | Passa a bloquear regressões frontend/PWA antes do deploy                                    | P1         | Epic + 5 sub-issues |
|   11 | [#91 — Tornar mutações financeiras confiáveis no frontend](https://github.com/leoferolive/nossagrana/issues/91)      | Evita duplo submit, fechamento prematuro e perda do formulário após erro                    | P1         | Epic + 5 sub-issues |
|   12 | [#92 — Extrato filtrável e paginado ponta a ponta](https://github.com/leoferolive/nossagrana/issues/92)              | Corrige crescimento ilimitado do payload e entrega o principal instrumento de consulta      | P1         | Epic + 5 sub-issues |
|   13 | [#93 — Health checks e observabilidade operacional](https://github.com/leoferolive/nossagrana/issues/93)             | Permite detectar banco indisponível, jobs atrasados, backup falho e degradação real         | P1         | Epic + 4 sub-issues |
|   14 | [#94 — Acessibilidade dos fluxos principais](https://github.com/leoferolive/nossagrana/issues/94)                    | Torna lançamentos, extrato, histórico e modais operáveis por teclado e tecnologia assistiva | P1         | Epic + 5 sub-issues |
|   15 | [#95 — Alinhar validações monetárias às constraints do banco](https://github.com/leoferolive/nossagrana/issues/95)   | Correção de baixo/médio esforço que impede overflow, escala inválida e valores incoerentes  | P2         | Issue única         |

### Hierarquia criada no GitHub

- **15 issues principais**, correspondentes exatamente ao ranking acima.
- **62 sub-issues**, usadas somente onde há entregas independentes ou ordem técnica relevante.
- Todas as sub-issues estão vinculadas formalmente à issue-mãe no GitHub.
- Labels adicionadas: `priority:P0`, `priority:P1`, `priority:P2`, `epic`, `area:security`, `area:data-integrity`, `area:infra`, `area:backend`, `area:frontend`, `area:testing`, `area:accessibility` e `area:performance`.
- Cada issue contém contexto, evidências do código, alternativas e trade-offs, recomendação, escopo e fora de escopo, plano técnico, critérios de aceite, TDD/testes, dependências e rollout/rollback quando aplicável.

### Ordem de execução entre epics

1. **Proteção operacional:** #44 antes de migrations ou alterações destrutivas.
2. **Fundações de integridade:** #54, #59 e #64; a Unit of Work de #64 pode ser reutilizada por #59, desde que a interface seja pequena e explícita.
3. **Autorização e sessão:** #46, #52 e #115; os testes reais de #52 devem acompanhar as correções de #54 e #46.
4. **Fechamento financeiro:** #50 e #51; a decisão de domínio de #51 precede a UI e os testes finais.
5. **Esteira e operação:** #53 e #93; readiness real ajuda o job E2E a iniciar serviços de forma determinística.
6. **Experiência essencial:** #91, #92 e #94; executar com a CI Web já ativa sempre que possível.
7. **Validação de boundary:** #95 pode ser executada em paralelo após estabilizar os contratos compartilhados.

### Itens deliberadamente fora do TOP 15

Insights automáticos, histórico de orçamento, importação OFX/CSV, exportação, planejamento de caixa e novas capacidades de produto continuam válidos. Eles foram mantidos abaixo do corte porque dependem de uma base segura, transacional, observável e testada. A recomendação é reavaliá-los após a conclusão dos itens 1–10.
