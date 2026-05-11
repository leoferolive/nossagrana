# Plano de Implementação — Quality Gate Objetivo

**Data:** 2026-05-11
**Branch:** `quality-gate-plan`
**Autor (agente):** Claude (Opus 4.7)

---

## Goal

Instalar um "quality gate" objetivo no NossaGrana — um único comando (`pnpm quality`) que mede o código e falha o build se métricas regredirem. Inspirado no post da Codeminer42 ("Pare de ler código de IA, comece a medi-lo"), adaptado à stack TypeScript/Node/React do projeto.

**Premissa central:** em vez de revisar saídas de IA linha-a-linha, medimos objetivamente. A IA roda o gate antes de commitar; a CI roda como guarda final. A saída é uma tabela `✓/✗` no terminal.

**Padrão "ratchet":** valores fora do ideal hoje não bloqueiam imediatamente — a baseline é versionada em `quality-baseline.json` e a regra passa a ser "nunca piore". À medida que o código melhora, a baseline é apertada manualmente.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Dev local                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    │
│  │ Husky pre-commit    │ →  │ skill pre-commit    │    │
│  │ (lint-staged)       │    │ chama pnpm quality  │    │
│  └─────────────────────┘    └──────────┬──────────┘    │
│                                        │               │
│                                        ▼               │
│                          ┌──────────────────────────┐  │
│                          │  pnpm quality            │  │
│                          │  (orquestrador shell)    │  │
│                          ├──────────────────────────┤  │
│                          │  1. oxlint               │  │
│                          │  2. eslint (+complexity) │  │
│                          │  3. type-check           │  │
│                          │  4. test:coverage api    │  │
│                          │  5. coverage:changed     │  │
│                          │  6. knip                 │  │
│                          │  7. ratchet:check        │  │
│                          ├──────────────────────────┤  │
│                          │  → tabela ✓/✗ final      │  │
│                          └──────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │  GitHub Actions (ci.yml)     │
                │  job "quality" reaproveita   │
                │  pnpm quality --ci           │
                └──────────────────────────────┘
```

### Decisão: shell sequencial vs Turbo

O comando `pnpm quality` será **shell sequencial** (Node script em `scripts/quality-gate.mjs`), não `turbo run quality`. Justificativas:

1. Precisamos **ordem determinística** e **parada no primeiro erro** com mensagens uniformes.
2. Precisamos coletar status de cada etapa para imprimir a tabela final `✓/✗`.
3. Turbo otimiza paralelismo entre packages, mas as etapas do gate são **diferentes verificações sobre o mesmo workspace** — não há ganho real.
4. Mantemos `pnpm lint`, `pnpm type-check` etc. usando Turbo internamente; o orquestrador chama esses scripts já existentes.

---

## Tech Stack (adicionado por este plano)

| Item | Versão | Motivo |
|---|---|---|
| `eslint-plugin-sonarjs` | `^3.x` | `cognitive-complexity`, `no-duplicate-string`, `no-identical-functions` |
| `eslint` builtin rules | já em `^9.23` | `complexity`, `max-depth`, `max-lines`, `max-lines-per-function`, `max-params` |
| Script `scripts/quality-gate.mjs` | novo | Orquestrador + impressão da tabela |
| Script `scripts/ratchet-check.mjs` | novo | Compara violações atuais vs baseline |
| Arquivo `quality-baseline.json` | novo, versionado | Piso de violações |
| `.github/dependabot.yml` | novo | Atualizações npm + actions semanais |
| `docs/quality-gate.md` | novo | Dimensões, thresholds, limitações |

**NÃO adicionamos:**

- Stryker (mutation testing) — custo de execução alto, fora do escopo.
- Plugin de complexidade ciclomática separado (ex: `eslint-plugin-complexity`) — as regras builtin do ESLint cobrem.

---

## Thresholds escolhidos e justificativas

O post da Codeminer42 usa thresholds Rails (cobertura ≥95%, complexity ≤6, ABC ≤15). **Não vamos copiar.** Justificativas por dimensão:

| Dimensão | Threshold | Justificativa |
|---|---|---|
| Cobertura linhas (API) | **80%** (mantém atual) | Já configurado em `apps/api/vitest.config.ts`. Mexer agora descalibra. Ratchet futuro pode subir. |
| Cobertura branches | **70%** (mantém atual) | Idem. |
| Cobertura linhas (arquivos alterados) | **80%** (mantém atual) | Já em `scripts/check-changed-coverage.mjs`. |
| `complexity` (ciclomática por função) | **≤ 10** | Valor padrão do ESLint. O post Rails usa 6, mas Ruby tem blocos/yields que reduzem ciclos; TypeScript com early-returns naturalmente fica entre 5 e 10. Começar conservador e usar ratchet. |
| `max-lines-per-function` | **≤ 50** (sem contar blank/comments) | Funções Fastify route handlers já tendem a 30–50 linhas com schema. 50 dá margem sem permitir megafunções. |
| `max-lines` (por arquivo) | **≤ 400** | Arquivos `*.routes.ts` agregam várias rotas e podem passar de 200 linhas legitimamente; 400 corta apenas casos patológicos. |
| `max-depth` | **≤ 4** | Padrão ESLint. Nested if/for além disso pede refactor. |
| `max-params` | **≤ 5** | Funções com mais de 5 parâmetros = sinal de objeto de configuração. |
| `sonarjs/cognitive-complexity` | **≤ 15** | Default do plugin. Cognitive complexity penaliza aninhamento mais do que ciclomática — sinal mais útil para legibilidade. |

**Importante:** essas regras entram como **`warn`** inicialmente, não `error`. O `ratchet-check.mjs` é quem falha o build comparando contagem de warnings vs baseline. Isso evita que mil arquivos quebrem de uma vez.

---

## File Structure

```
nossagrana/
├── .claude/
│   └── skills/
│       ├── code-quality-guard/SKILL.md       # ATUALIZADO (Regra 8 nova)
│       └── pre-commit/SKILL.md               # ATUALIZADO (pipeline reduz para `pnpm quality`)
├── .github/
│   ├── dependabot.yml                        # NOVO
│   └── workflows/
│       └── ci.yml                            # ATUALIZADO (job quality usa pnpm quality)
├── docs/
│   └── quality-gate.md                       # NOVO
├── scripts/
│   ├── check-changed-coverage.mjs            # mantém
│   ├── quality-gate.mjs                      # NOVO — orquestrador
│   └── ratchet-check.mjs                     # NOVO — verifica baseline
├── eslint.config.mjs                          # ATUALIZADO (regras de complexidade)
├── quality-baseline.json                      # NOVO — versionado
├── package.json                               # ATUALIZADO (scripts: quality, quality:ci, ratchet:update)
└── CLAUDE.md                                  # ATUALIZADO (seção "Quality Gate")
```

---

## Tarefas

### Tarefa 1 — Adicionar regras de complexidade ao ESLint (como `warn`)

**Objetivo:** ESLint passa a relatar (não bloquear) violações de complexidade. Baseline ratchet captura o estado atual.

**Steps:**

- [ ] **1.1** Instalar `eslint-plugin-sonarjs`:
  ```bash
  cd /home/leoferolive/projetos/nossagrana-wt-quality-gate
  pnpm add -Dw eslint-plugin-sonarjs
  ```
  **Esperado:** `+ eslint-plugin-sonarjs 3.x.x` em devDependencies do root.

- [ ] **1.2** Editar `eslint.config.mjs` — adicionar import e bloco de regras de complexidade. Adicionar AO FINAL (antes de `eslintConfigPrettier`):

  ```js
  import sonarjs from 'eslint-plugin-sonarjs';
  // ... resto do arquivo

  // Bloco novo (antes de eslintConfigPrettier):
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: {
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 5],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
    },
  },
  ```

  Exceção para testes (eles podem ser longos):

  ```js
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/e2e/**'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  ```

- [ ] **1.3** Rodar lint para confirmar que **passa** (warnings não bloqueiam):
  ```bash
  pnpm lint
  ```
  **Esperado:** comando termina com exit 0; haverá lista de warnings.

- [ ] **1.4** Capturar quantidade de warnings em JSON para a baseline:
  ```bash
  pnpm exec eslint . --format json --output-file /tmp/eslint-report.json || true
  node -e "const r=require('/tmp/eslint-report.json');const c={};for(const f of r){for(const m of f.messages){if(m.severity===1){c[m.ruleId]=(c[m.ruleId]||0)+1}}}console.log(JSON.stringify(c,null,2))"
  ```
  **Esperado:** objeto com contagens por regra. Anotar para Tarefa 5.

---

### Tarefa 2 — Criar script `scripts/quality-gate.mjs`

**Objetivo:** comando único que roda todas as etapas e imprime tabela `✓/✗`.

**Steps:**

- [ ] **2.1** Criar `scripts/quality-gate.mjs`:

  ```js
  #!/usr/bin/env node
  import { spawnSync } from 'node:child_process';
  import { performance } from 'node:perf_hooks';

  const isCI = process.argv.includes('--ci') || process.env.CI === 'true';

  const steps = [
    { id: 'oxlint',      cmd: 'pnpm', args: ['lint:fast'],               desc: 'Lint rápido (Oxlint)' },
    { id: 'eslint',      cmd: 'pnpm', args: ['lint'],                    desc: 'Lint completo (ESLint)' },
    { id: 'types',       cmd: 'pnpm', args: ['type-check'],              desc: 'TypeScript strict' },
    { id: 'test-cov',    cmd: 'pnpm', args: ['--filter','api','test:coverage'], desc: 'Testes + cobertura API' },
    { id: 'changed-cov', cmd: 'pnpm', args: ['coverage:changed-check'],  desc: 'Cobertura ≥80% nos arquivos alterados', optional: !process.env.CHANGED_FILES },
    { id: 'knip',        cmd: 'pnpm', args: ['knip'],                    desc: 'Dead code (Knip)' },
    { id: 'ratchet',     cmd: 'node', args: ['scripts/ratchet-check.mjs'], desc: 'Ratchet de complexidade' },
  ];

  // Testes web só rodam fora do CI (ARM64 Pi)
  if (!isCI) {
    steps.splice(4, 0, {
      id: 'test-web',
      cmd: 'pnpm', args: ['--filter','web','test','--','--run'],
      desc: 'Testes Web (apenas local)',
    });
  }

  const results = [];
  for (const step of steps) {
    if (step.optional) {
      results.push({ ...step, status: 'skip', ms: 0 });
      continue;
    }
    process.stdout.write(`▶ ${step.desc}…\n`);
    const t0 = performance.now();
    const r = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell: false });
    const ms = Math.round(performance.now() - t0);
    results.push({ ...step, status: r.status === 0 ? 'pass' : 'fail', ms });
    if (r.status !== 0) break; // fail-fast
  }

  // Tabela final
  const w1 = Math.max(...results.map(r => r.desc.length), 30);
  console.log('\n' + '─'.repeat(w1 + 18));
  console.log('Quality Gate'.padEnd(w1 + 18));
  console.log('─'.repeat(w1 + 18));
  for (const r of results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '·';
    const time = r.status === 'skip' ? '—' : `${r.ms}ms`;
    console.log(`${icon} ${r.desc.padEnd(w1)}  ${time.padStart(8)}`);
  }
  for (const r of results.filter(x => !['pass','skip'].includes(x.status))) {
    // se houve falha, código != 0
    process.exit(1);
  }
  // Se algum step não rodou (fail-fast cortou), também falha
  if (results.length < steps.length) process.exit(1);
  console.log('─'.repeat(w1 + 18));
  console.log('Todos os checks passaram. Pode commitar.\n');
  ```

- [ ] **2.2** Tornar executável:
  ```bash
  chmod +x scripts/quality-gate.mjs
  ```

- [ ] **2.3** Adicionar scripts no `package.json` raiz:
  ```json
  "quality": "node scripts/quality-gate.mjs",
  "quality:ci": "node scripts/quality-gate.mjs --ci",
  "ratchet:update": "node scripts/ratchet-check.mjs --update"
  ```

- [ ] **2.4** Testar localmente:
  ```bash
  pnpm quality
  ```
  **Esperado:** tabela com `✓` em todas as linhas e exit 0.

---

### Tarefa 3 — Criar `scripts/ratchet-check.mjs`

**Objetivo:** contar violações de complexidade atuais e comparar com `quality-baseline.json`. Falha se contagem aumentar; aceita reduções silenciosamente.

**Steps:**

- [ ] **3.1** Criar `scripts/ratchet-check.mjs`:

  ```js
  #!/usr/bin/env node
  import { spawnSync } from 'node:child_process';
  import fs from 'node:fs';
  import path from 'node:path';

  const BASELINE_PATH = path.resolve('quality-baseline.json');
  const RULES = [
    'complexity',
    'max-depth',
    'max-lines',
    'max-lines-per-function',
    'max-params',
    'sonarjs/cognitive-complexity',
    'sonarjs/no-duplicate-string',
    'sonarjs/no-identical-functions',
  ];

  function countViolations() {
    const r = spawnSync('pnpm', ['exec', 'eslint', '.', '--format', 'json'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    // ESLint retorna 1 se há warnings/errors; ignoramos esse exit code
    const report = JSON.parse(r.stdout);
    const counts = Object.fromEntries(RULES.map(r => [r, 0]));
    for (const file of report) {
      for (const m of file.messages) {
        if (RULES.includes(m.ruleId)) counts[m.ruleId]++;
      }
    }
    return counts;
  }

  const current = countViolations();
  const update = process.argv.includes('--update');

  if (update || !fs.existsSync(BASELINE_PATH)) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n');
    console.log('quality-baseline.json atualizado:', current);
    process.exit(0);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const regressions = [];
  for (const rule of RULES) {
    const before = baseline[rule] ?? 0;
    const now = current[rule] ?? 0;
    if (now > before) regressions.push({ rule, before, now });
  }

  if (regressions.length) {
    console.error('\nRatchet violado — novas violações de complexidade:');
    for (const r of regressions) {
      console.error(`  ✗ ${r.rule}: ${r.before} → ${r.now} (+${r.now - r.before})`);
    }
    console.error('\nReduza a complexidade ou justifique e rode `pnpm ratchet:update`.');
    process.exit(1);
  }

  // Reportar reduções (informativo)
  for (const rule of RULES) {
    const before = baseline[rule] ?? 0;
    const now = current[rule] ?? 0;
    if (now < before) console.log(`  ✓ ${rule}: ${before} → ${now} (-${before - now})`);
  }
  console.log('Ratchet OK.');
  ```

- [ ] **3.2** Gerar baseline inicial:
  ```bash
  pnpm ratchet:update
  ```
  **Esperado:** cria `quality-baseline.json` com as contagens atuais.

- [ ] **3.3** Confirmar que rodar sem alterações **passa**:
  ```bash
  node scripts/ratchet-check.mjs
  ```
  **Esperado:** `Ratchet OK.` e exit 0.

---

### Tarefa 4 — Criar `.github/dependabot.yml`

**Objetivo:** Dependabot semanal para npm + GitHub Actions.

**Steps:**

- [ ] **4.1** Criar `.github/dependabot.yml`:
  ```yaml
  version: 2
  updates:
    - package-ecosystem: npm
      directory: /
      schedule:
        interval: weekly
        day: monday
        time: '06:00'
        timezone: America/Sao_Paulo
      open-pull-requests-limit: 5
      groups:
        eslint:
          patterns: ['eslint*', '@typescript-eslint/*', 'typescript-eslint']
        vitest:
          patterns: ['vitest', '@vitest/*']
        types:
          patterns: ['@types/*']
      ignore:
        # major bumps que precisam migração manual
        - dependency-name: 'react'
          update-types: ['version-update:semver-major']
        - dependency-name: 'fastify'
          update-types: ['version-update:semver-major']

    - package-ecosystem: github-actions
      directory: /
      schedule:
        interval: weekly
        day: monday
  ```

- [ ] **4.2** Validar sintaxe:
  ```bash
  pnpm dlx js-yaml .github/dependabot.yml > /dev/null && echo "YAML válido"
  ```

---

### Tarefa 5 — Atualizar CI (`.github/workflows/ci.yml`)

**Objetivo:** job `quality` usa `pnpm quality:ci` (uma chamada) em vez de quatro chamadas separadas.

**Steps:**

- [ ] **5.1** Ler o ci.yml atual e localizar o job `quality`. Substituir os steps de oxlint/eslint/type-check/build/knip por:
  ```yaml
  - name: Quality Gate
    run: pnpm quality:ci
  ```
  Manter o step de build separado se a CI faz upload de artifacts.

- [ ] **5.2** Confirmar que `coverage:changed-check` continua sendo chamado no job `api-tests` (com `CHANGED_FILES` setado) — **não mover** para dentro do `quality:ci` no modo CI, pois requer `git diff`.

- [ ] **5.3** Validar workflow:
  ```bash
  pnpm dlx js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML válido"
  ```

---

### Tarefa 6 — Alinhar skill `pre-commit`

**Objetivo:** reduzir o checklist da skill para `pnpm quality`, eliminando duplicação. A skill mantém o contexto de "regras críticas" mas o pipeline de comandos vira uma linha.

**Steps:**

- [ ] **6.1** Editar `.claude/skills/pre-commit/SKILL.md`. Substituir a seção "Pipeline (mesma ordem da CI)" inteira por:

  ```markdown
  ## Pipeline

  Um único comando roda tudo (Prettier nos arquivos staged é feito pelo Husky):

  ```bash
  pnpm quality
  ```

  O script imprime tabela `✓/✗` ao final. Se algo falhar, ele para no primeiro erro e mostra qual etapa quebrou. Etapas (na ordem):

  1. Oxlint (rápido)
  2. ESLint (com regras de complexidade)
  3. Type-check
  4. Testes API com cobertura
  5. Testes Web (apenas local, não roda em `--ci`)
  6. `coverage:changed-check` (se `CHANGED_FILES` setado)
  7. Knip (dead code)
  8. Ratchet de complexidade (compara com `quality-baseline.json`)

  **Se o ratchet falhar:** você introduziu novas violações de complexidade. Refatore ou, se justificável (raro), rode `pnpm ratchet:update` para atualizar a baseline.
  ```

- [ ] **6.2** Manter intactas as seções "Pré-requisito" (build de types) e "Regras Críticas".

- [ ] **6.3** Substituir a seção "Se Tudo Passar" por:
  ```markdown
  ## Se Tudo Passar

  A tabela final mostra todos os `✓`. Pode commitar.
  ```

---

### Tarefa 7 — Atualizar skill `code-quality-guard` (CUIDADO: autoApply)

**Objetivo:** adicionar regra sobre complexidade. Mudanças nessa skill afetam **todo** trabalho de implementação do usuário.

**Princípio:** **adicionar**, não reescrever. Manter as 7 regras existentes.

**Steps:**

- [ ] **7.1** Adicionar **Regra 8** ao final de `.claude/skills/code-quality-guard/SKILL.md`, antes do "Checklist Mental por Arquivo":

  ```markdown
  ## Regra 8: Complexidade

  ESLint reporta (warn) funções com:

  - `complexity` (ciclomática) > 10
  - `cognitive-complexity` > 15
  - `max-lines-per-function` > 50
  - `max-depth` > 4
  - `max-params` > 5

  Warnings não quebram o lint, mas o **ratchet** (`pnpm quality` etapa final) falha se o número total de violações aumentar.

  **Ao escrever uma função nova:**

  - Prefira early-returns sobre `else` aninhado.
  - Extraia condicionais complexas em funções nomeadas.
  - Use objetos de configuração quando precisar de mais de 5 parâmetros.

  **Refatorações que ajudam:**

  - `if (!x) return; ...` em vez de `if (x) { ... }`.
  - Helpers privados no mesmo arquivo (não exportados) — Knip não reclama.
  - Substituir `switch` longos por dicionários (`Record<K, fn>`).
  ```

- [ ] **7.2** Adicionar item ao "Checklist Mental por Arquivo":
  ```markdown
  - [ ] Funções com ≤ 10 de complexidade ciclomática? ≤ 50 linhas?
  ```

- [ ] **7.3** **Não** mudar o `autoApply: true`. **Não** remover regras existentes.

---

### Tarefa 8 — Atualizar `CLAUDE.md` raiz

**Objetivo:** o agente precisa saber que existe um `pnpm quality` e que ele é o gate antes de commitar.

**Steps:**

- [ ] **8.1** Adicionar seção nova em `CLAUDE.md` raiz, logo após "Processo de Desenvolvimento":

  ```markdown
  ### Quality Gate

  Antes de qualquer commit, rodar:

  ```bash
  pnpm quality
  ```

  Esse comando roda lint, type-check, testes, cobertura, knip e ratchet de complexidade em sequência, parando no primeiro erro. A skill `pre-commit` referencia esse mesmo script.

  **Não bypasse o gate.** Se uma etapa falhar, corrija — não rode `git commit --no-verify`. Se o ratchet falhar legitimamente (refactor que aumenta uma métrica pontual), atualize a baseline com `pnpm ratchet:update` e justifique no commit message.

  Limitações conhecidas do gate em `docs/quality-gate.md`.
  ```

---

### Tarefa 9 — Documentar em `docs/quality-gate.md`

**Objetivo:** referência humana das dimensões, thresholds e limitações.

**Steps:**

- [ ] **9.1** Criar `docs/quality-gate.md` com seções:

  ```markdown
  # Quality Gate

  Comando único: `pnpm quality`. Output: tabela `✓/✗` no terminal.

  ## Dimensões medidas

  | Dimensão | Ferramenta | Threshold | Bloqueia? |
  |---|---|---|---|
  | Lint rápido | Oxlint | regras default | sim (error) |
  | Lint completo | ESLint + typescript-eslint | regras strict | sim (error) |
  | Type strict | tsc --noEmit | strict: true | sim (error) |
  | Cobertura linhas (API) | Vitest v8 | ≥ 80% | sim |
  | Cobertura branches | Vitest v8 | ≥ 70% | sim |
  | Cobertura arq. alterados | check-changed-coverage | ≥ 80% | sim (se CHANGED_FILES) |
  | Dead code | Knip | zero exports não usados | sim |
  | Complexidade ciclomática | ESLint `complexity` | ≤ 10 | ratchet |
  | Cognitive complexity | sonarjs | ≤ 15 | ratchet |
  | Linhas por função | ESLint | ≤ 50 | ratchet |
  | Linhas por arquivo | ESLint | ≤ 400 | ratchet |
  | Profundidade nesting | ESLint | ≤ 4 | ratchet |
  | Parâmetros por função | ESLint | ≤ 5 | ratchet |

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
  ```

---

### Tarefa 10 — Validação ponta-a-ponta

- [ ] **10.1** Rodar tudo localmente:
  ```bash
  pnpm install
  pnpm quality
  ```
  **Esperado:** tabela `✓` em todas as linhas.

- [ ] **10.2** Forçar uma regressão de complexidade (criar função com 11 branches) e confirmar que `pnpm quality` falha na etapa "Ratchet".

- [ ] **10.3** Reverter, rodar `pnpm quality` de novo, ver `✓`.

- [ ] **10.4** Verificar que Husky pre-commit hook ainda roda Prettier (não conflita com `pnpm quality`).

---

## Alinhamento com skills existentes

| Skill | Mudança | Risco |
|---|---|---|
| `pre-commit` | Pipeline de 9 comandos vira `pnpm quality`. Regras Críticas preservadas. | Baixo — o agente já usa o script, comportamento idêntico. |
| `code-quality-guard` (`autoApply: true`) | Adiciona Regra 8 (complexidade) e um item no checklist mental. **Não** remove nem altera as 7 regras existentes. | Médio — autoApply afeta todo trabalho; mas a adição é incremental e contextual. |
| `tdd-workflow` | Sem mudança. | Nenhum. |
| `generate-module` | Sem mudança. Funções geradas naturalmente passam nos thresholds. | Nenhum. |
| `drizzle-migration`, `create-page`, `create-e2e-test` | Sem mudança. | Nenhum. |

**Princípio:** o gate é uma camada de **medição**, não substitui as skills de **execução**. A skill `pre-commit` continua existindo porque mantém o contexto sobre "regras críticas" (schema Fastify, exports de types) que o agente precisa ter em mente — mas o pipeline de comandos vira uma linha.

---

## Limitações reconhecidas

Reproduzindo a honestidade do post original — o gate **não substitui**:

1. **Revisão humana de intenção:** o gate verifica que o código está bem-formado, não que resolve o problema certo. Casos de uso financeiros (mês de referência de cartão, snapshot mensal divergente) exigem code review humano.
2. **Segurança runtime:** Semgrep + Gitleaks já cobrem padrões conhecidos, mas IDOR semântico (ex: filtro por `familia_id` esquecido em UMA query nova) escapa do lint. Os testes de isolamento multi-tenant (regra `.claude/rules/security.md`) continuam essenciais.
3. **Race conditions:** TypeScript/Node single-threaded reduz a superfície, mas concorrência via WebSocket e jobs node-cron não está coberta.
4. **Cobertura de mutação:** linhas cobertas ≠ asserts úteis. Mutation testing (Stryker) ficaria como próxima iteração — fora do escopo.
5. **Acessibilidade e UX:** o gate não inspeciona DOM nem semântica de componentes React.
6. **Performance:** sem budget de bundle, sem profiler de queries, sem detecção de N+1.

O valor do gate é **objetividade**: substitui revisões cansativas linha-a-linha por uma tabela `✓/✗`. Para o que ele não cobre, mantemos os mecanismos existentes (E2E, Semgrep, code review humano em PRs de domínio crítico).

---

## Ordem sugerida de execução

Tarefas 1 → 3 são a fundação (ESLint + ratchet). Tarefa 2 depende delas. Tarefas 4, 6, 7, 8, 9 são independentes e podem ser feitas em qualquer ordem após 1–3. Tarefa 5 (CI) deve vir **depois** de 1–3 estarem validadas localmente. Tarefa 10 é a validação final.

Cada tarefa é um commit separado para facilitar revert se algo quebrar.
