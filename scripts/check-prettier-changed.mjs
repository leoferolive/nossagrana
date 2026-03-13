import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const changedFilesRaw = process.env.CHANGED_FILES ?? '';
const rootDir = process.cwd();

const files = changedFilesRaw
  ? changedFilesRaw
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
      .filter((file) => !file.startsWith('pnpm-lock.yaml'))
      .filter((file) => fs.existsSync(path.join(rootDir, file)))
  : [];

if (files.length === 0) {
  console.log('No changed files detected for prettier check.');
  process.exit(0);
}

execFileSync('pnpm', ['exec', 'prettier', '--check', '--ignore-unknown', ...files], {
  stdio: 'inherit',
});
