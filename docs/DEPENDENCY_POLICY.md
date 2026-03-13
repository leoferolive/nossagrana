# Dependency Policy

Policy to keep toolchain and dependencies predictable across local and CI environments.

## Cadence

- Run dependency check every week (automated workflow).
- Run planned dependency update once per month.
- Avoid ad-hoc upgrades in feature PRs unless required for a fix.

## Commands

- Check outdated packages:
  - `pnpm deps:check`
- Update lockfile in a controlled batch:
  - `pnpm deps:update`
- Validate after update:
  - `pnpm lint && pnpm type-check && pnpm build`

## Rules

- Keep `pnpm-lock.yaml` committed and updated in the same PR as dependency changes.
- If a dependency update changes build/runtime behavior, document the change in PR notes.
- Prioritize updating build toolchain together (`typescript`, `vite`, `turbo`, eslint stack) to avoid partial drift.
