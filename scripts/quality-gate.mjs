#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const isCI = process.argv.includes('--ci') || process.env.CI === 'true';

const steps = [
  { id: 'oxlint', cmd: 'pnpm', args: ['lint:fast'], desc: 'Lint rápido (Oxlint)' },
  { id: 'eslint', cmd: 'pnpm', args: ['lint'], desc: 'Lint completo (ESLint)' },
  { id: 'types', cmd: 'pnpm', args: ['type-check'], desc: 'TypeScript strict' },
  {
    id: 'test-cov',
    cmd: 'pnpm',
    args: ['--filter', 'api', 'test:coverage'],
    desc: 'Testes + cobertura API',
  },
  {
    id: 'changed-cov',
    cmd: 'pnpm',
    args: ['coverage:changed-check'],
    desc: 'Cobertura ≥80% nos arquivos alterados',
    optional: !process.env.CHANGED_FILES,
  },
  { id: 'knip', cmd: 'pnpm', args: ['knip'], desc: 'Dead code (Knip)' },
  {
    id: 'ratchet',
    cmd: 'node',
    args: ['scripts/ratchet-check.mjs'],
    desc: 'Ratchet de complexidade',
  },
];

// Testes web só rodam fora do CI (ARM64 Pi)
if (!isCI) {
  steps.splice(4, 0, {
    id: 'test-web',
    cmd: 'pnpm',
    args: ['--filter', 'web', 'test', '--', '--run'],
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
const w1 = Math.max(...results.map((r) => r.desc.length), 30);
console.log('\n' + '─'.repeat(w1 + 18));
console.log('Quality Gate'.padEnd(w1 + 18));
console.log('─'.repeat(w1 + 18));
for (const r of results) {
  const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '·';
  const time = r.status === 'skip' ? '—' : `${r.ms}ms`;
  console.log(`${icon} ${r.desc.padEnd(w1)}  ${time.padStart(8)}`);
}
// Se houve falha em qualquer step, código != 0
if (results.some((r) => r.status === 'fail')) process.exit(1);
// Se algum step não rodou (fail-fast cortou), também falha
if (results.length < steps.length) process.exit(1);
console.log('─'.repeat(w1 + 18));
console.log('Todos os checks passaram. Pode commitar.\n');
