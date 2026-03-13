import fs from 'node:fs';
import path from 'node:path';

const MIN_COVERAGE = Number(process.env.MIN_CHANGED_COVERAGE ?? '80');
const changedFilesRaw = process.env.CHANGED_FILES ?? '';

const rootDir = process.cwd();
const summaryPaths = [
  path.join(rootDir, 'apps/api/coverage/coverage-summary.json'),
  path.join(rootDir, 'apps/web/coverage/coverage-summary.json'),
];

const coverageByFile = new Map();

for (const summaryPath of summaryPaths) {
  if (!fs.existsSync(summaryPath)) {
    continue;
  }

  const json = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  for (const [fileKey, metrics] of Object.entries(json)) {
    if (fileKey === 'total') {
      continue;
    }
    const relativePath = path.relative(rootDir, fileKey).replace(/\\/g, '/');
    coverageByFile.set(relativePath, metrics);
  }
}

if (coverageByFile.size === 0) {
  console.error('Coverage summary files were not found. Run test:coverage first.');
  process.exit(1);
}

const changedFiles = changedFilesRaw
  ? changedFilesRaw
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
      .filter((file) => /^apps\/(api|web)\/src\/.+\.(ts|tsx)$/.test(file))
      .filter((file) => !/\.test\.(ts|tsx)$/.test(file))
  : [];

if (changedFiles.length === 0) {
  console.log('No changed source files detected for coverage gate.');
  process.exit(0);
}

let hasFailure = false;

for (const changedFile of changedFiles) {
  const coverageEntry =
    coverageByFile.get(changedFile) ??
    [...coverageByFile.entries()].find(([coveredFile]) => coveredFile.endsWith(changedFile))?.[1];

  if (!coverageEntry) {
    hasFailure = true;
    console.error(`- ${changedFile}: no coverage data found (expected >= ${MIN_COVERAGE}%)`);
    continue;
  }

  const linesPct = Number(coverageEntry.lines?.pct ?? 0);
  const status = linesPct >= MIN_COVERAGE ? 'PASS' : 'FAIL';
  console.log(`- ${changedFile}: ${linesPct}% lines (${status})`);

  if (linesPct < MIN_COVERAGE) {
    hasFailure = true;
  }
}

if (hasFailure) {
  console.error(`Changed-file coverage gate failed (minimum ${MIN_COVERAGE}%).`);
  process.exit(1);
}

console.log(`Changed-file coverage gate passed (minimum ${MIN_COVERAGE}%).`);
