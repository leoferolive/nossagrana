import { execFileSync } from 'node:child_process';

const changedFilesRaw = process.env.CHANGED_FILES ?? '';

const files = changedFilesRaw
  ? changedFilesRaw
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
      .filter((file) => !file.startsWith('pnpm-lock.yaml'))
  : [];

if (files.length === 0) {
  console.log('No changed files detected for prettier check.');
  process.exit(0);
}

execFileSync('pnpm', ['exec', 'prettier', '--check', ...files], {
  stdio: 'inherit',
});
