# Quality Gate

Comando único: `pnpm quality`. Output: tabela `✓/✗` no terminal.

## Dimensões medidas

| Dimensão                 | Ferramenta                 | Threshold               | Bloqueia?              |
| ------------------------ | -------------------------- | ----------------------- | ---------------------- |
| Lint rápido              | Oxlint                     | regras default          | sim (error)            |
| Lint completo            | ESLint + typescript-eslint | regras strict           | sim (error)            |
| Type strict              | tsc --noEmit               | strict: true            | sim (error)            |
| Cobertura linhas (API)   | Vitest v8                  | ≥ 80%                   | sim                    |
| Cobertura branches       | Vitest v8                  | ≥ 70%                   | sim                    |
| Cobertura arq. alterados | check-changed-coverage     | ≥ 80%                   | sim (se CHANGED_FILES) |
| Dead code                | Knip                       | zero exports não usados | sim                    |
| Complexidade ciclomática | ESLint `complexity`        | ≤ 10                    | ratchet                |
| Cognitive complexity     | sonarjs                    | ≤ 15                    | ratchet                |
| Linhas por função        | ESLint                     | ≤ 50                    | ratchet                |
| Linhas por arquivo       | ESLint                     | ≤ 400                   | ratchet                |
| Profundidade nesting     | ESLint                     | ≤ 4                     | ratchet                |
| Parâmetros por função    | ESLint                     | ≤ 5                     | ratchet                |

## Marcador para commits do Claude Code

Fora do CI, o gate captura `git write-tree` antes da primeira etapa e, se tudo passar e o índice não tiver mudado, grava `$(git rev-parse --git-path quality-gate)/<hash>`. Não grava (só avisa) com mudanças não staged, não rastreados em `apps/`/`packages/`/`scripts/`, índice em conflito ou índice alterado durante o gate. O `.husky/pre-commit` exige esse marcador quando `CLAUDECODE=1` (via `scripts/check-quality-marker.mjs`), garantindo que os testes Web (que não rodam no CI) passaram para exatamente o conteúdo commitado. Por isso o lint-staged roda **antes** da checagem: se o prettier reformatar e re-stagear arquivos, a árvore muda, o commit é bloqueado e é preciso rodar `pnpm quality` de novo. Commits humanos seguem só com lint-staged.

Fluxo: `git add <arquivos da mudança>` (ou `git add -u` + arquivos novos) → `pnpm exec prettier --write <arquivos>` + `git add <arquivos>` (formatar antes do gate evita um segundo ciclo) → `pnpm quality` → `git commit`. Evite `git add -A` — não stageie `planilha/` nem rascunhos. Os scripts têm testes próprios (`pnpm test:scripts`), executados no job `quality` do CI.

## Como funciona o ratchet

`quality-baseline.json` versionado contém a contagem atual de violações por regra. O CI falha se uma regra passar do valor da baseline. Reduções são aceitas silenciosamente — a baseline só "aperta" via `pnpm ratchet:update` manual em PR dedicado.

## Por que não copiamos os thresholds do post Rails

O post de referência (Codeminer42) usa complexity ≤ 6 e cobertura ≥ 95% em stack Rails. Adaptamos para TypeScript/Node porque:

- Stack TS com early-returns e narrowing naturalmente fica entre 5 e 10 de complexidade.
- Cobertura ≥ 95% em monorepo com Vite/Fastify exige testar serializadores triviais — ROI baixo.
- O ratchet substitui o threshold ideal: começamos onde estamos e nunca pioramos.

## Limitações reconhecidas

Igual ao post original, **o gate não cobre**:

- Segurança em runtime (ataques de injeção via input, IDOR semântico)
- Race conditions e concorrência
- Lógica de negócio incorreta que satisfaz o teste mas não a regra real
- Acessibilidade e UX
- Performance de queries (N+1, índices)

Para esses, mantemos:

- Semgrep no CI (`p/owasp-top-ten`, `p/javascript`, `p/secrets`)
- Gitleaks
- Code review humano em mudanças de domínio crítico (parcelas, mês de referência, snapshot)
- Testes E2E (Playwright) para fluxos críticos

## O que NÃO está neste gate (e por quê)

- **Mutation testing (Stryker):** custo de execução muito alto, deixa pipeline lento. Avaliar em iteração futura se ainda houver bugs sutis em código com 100% de cobertura.
- **Bundle size budget:** o frontend roda em LAN local; sem motivação imediata.
- **A11y automatizado (axe):** vale como item separado em PR futuro.
