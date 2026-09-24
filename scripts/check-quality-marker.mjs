#!/usr/bin/env node
// Usado pelo .husky/pre-commit em commits do Claude Code (CLAUDECODE=1):
// bloqueia o commit se `pnpm quality` não passou para o conteúdo staged.
import { checkQualityMarker } from './quality-marker.mjs';

const verdict = checkQualityMarker(process.cwd());

if (!verdict.ok) {
  console.error(
    [
      `✗ Commit bloqueado: ${verdict.reason}.`,
      '  Dê `git add <arquivos da mudança>` e rode `pnpm quality` antes de commitar.',
      '  Os testes Web não rodam no CI — a suíte completa precisa rodar localmente.',
    ].join('\n'),
  );
  process.exit(1);
}
