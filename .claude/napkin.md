# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-03-11] Validate critical flows after every meaningful code change**
   Do instead: run the smallest relevant automated checks first, then broaden only if needed.

## Shell & Command Reliability
1. **[2026-03-11] `pnpm` may be unavailable in fresh environments**
   Do instead: run `corepack enable && corepack prepare pnpm@9.15.0 --activate` before install/build checks.
2. **[2026-03-11] Prefer fast, scoped search commands**
   Do instead: use `rg`/`rg --files` with directory scoping before broader shell patterns.

## Domain Behavior Guardrails
1. **[2026-03-11] Preserve unrelated local changes**
   Do instead: edit only task-related files and never revert existing user changes unless explicitly requested.

## User Directives
1. **[2026-03-11] Keep response style concise and action-oriented**
   Do instead: summarize outcome first, include only necessary details, and list next steps only when useful.
