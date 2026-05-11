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
  const counts = Object.fromEntries(RULES.map((r) => [r, 0]));
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
