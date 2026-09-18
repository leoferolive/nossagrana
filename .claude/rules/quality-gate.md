# Quality Gate

Antes de qualquer commit, rodar:

```bash
pnpm quality
```

Esse comando roda lint, type-check, testes, cobertura, knip e ratchet de complexidade em sequência, parando no primeiro erro. A skill `pre-commit` referencia esse mesmo script.

**Não bypasse o gate.** Se uma etapa falhar, corrija — não rode `git commit --no-verify`. Se o ratchet falhar legitimamente (refactor que aumenta uma métrica pontual), atualize a baseline com `pnpm ratchet:update` e justifique no commit message.

Limitações conhecidas do gate em `docs/quality-gate.md`.
