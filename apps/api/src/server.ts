import { buildApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { iniciarSnapshotJob } from './modules/historico/snapshot.job.js';

const start = async () => {
  try {
    await runMigrations();
  } catch (error) {
    console.error('[migrate] Migration failed, aborting startup:', error);
    process.exit(1);
  }

  const app = buildApp();

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.PORT,
    });
    iniciarSnapshotJob();
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
