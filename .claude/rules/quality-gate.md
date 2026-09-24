# Quality Gate

Antes de qualquer commit, rodar:

```bash
pnpm quality
```

Esse comando roda lint, type-check, testes, cobertura, knip e ratchet de complexidade em sequência, parando no primeiro erro. A skill `pre-commit` referencia esse mesmo script.

**Não bypasse o gate.** Se uma etapa falhar, corrija — não rode `git commit --no-verify`. Se o ratchet falhar legitimamente (refactor que aumenta uma métrica pontual), atualize a baseline com `pnpm ratchet:update` e justifique no commit message.

## Commits do Claude Code (marcador + pre-commit)

Os testes Web não rodam no CI, então o Claude precisa rodar a suíte completa localmente. Isso é garantido de forma determinística:

- O gate captura o índice (`git write-tree`) **antes** da primeira etapa. Se tudo passar fora do CI e o índice continuar igual no fim, grava um marcador em `$(git rev-parse --git-path quality-gate)/<hash>` (por worktree).
- O marcador **não** é gravado (aviso `⚠`, sem mudar o exit code) se houver mudanças não staged, arquivos não rastreados em `apps/`, `packages/` ou `scripts/`, índice em conflito, ou se o índice mudar durante o gate. Não rastreados em outros caminhos só geram aviso.
- O `.husky/pre-commit`, quando `CLAUDECODE=1`, roda primeiro o `lint-staged` (prettier, que pode re-stagear arquivos) e **depois** `scripts/check-quality-marker.mjs`, bloqueando o commit sem marcador para o índice resultante (inclusive `git commit -a` com mudança não testada). Se o prettier reformatou algo, o marcador deixa de valer: rode `pnpm quality` de novo e commite. Commits humanos rodam só o lint-staged.
- Fluxo: `git add <arquivos da mudança>` (ou `git add -u` + arquivos novos) → `pnpm exec prettier --write <arquivos>` + `git add <arquivos>` (formatar **antes** do gate evita um segundo ciclo) → `pnpm quality` → `git commit`. **Não** faça `git add -A`: não stageie `planilha/`, rascunhos nem arquivos alheios à mudança.
- Testes dos scripts: `pnpm test:scripts` (rodam no job `quality` do CI).

Limitações conhecidas do gate em `docs/quality-gate.md`.
