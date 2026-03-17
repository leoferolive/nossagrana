import { execSync } from 'child_process';
import { config as dotenv } from 'dotenv';
import { resolve } from 'path';

dotenv({ path: resolve(__dirname, '.env.e2e') });

export default async function globalSetup() {
  const dbUrl =
    process.env.DATABASE_URL ??
    'postgresql://nossagrana_e2e:nossagrana_e2e@localhost:5433/nossagrana_e2e';

  execSync(`DATABASE_URL=${dbUrl} pnpm --filter api db:migrate`, {
    stdio: 'inherit',
    cwd: resolve(__dirname, '../..'),
  });
}
