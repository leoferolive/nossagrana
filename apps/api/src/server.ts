import { buildApp } from './app.js';
import { env } from './config/env.js';
import { iniciarSnapshotJob } from './modules/historico/snapshot.job.js';

const start = async () => {
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
