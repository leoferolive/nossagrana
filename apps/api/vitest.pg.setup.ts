import { randomBytes } from 'node:crypto';

// Env fictício só para os módulos importados pelos testes pg (ex.: `config/env.ts`,
// `db/client.ts`). A conexão do `db` global é preguiçosa e nunca é aberta: os testes
// pg injetam a conexão do banco descartável. Nenhuma credencial real.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://nunca-conecta:nunca-conecta@127.0.0.1:1/nunca_conecta';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.REFRESH_TOKEN_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_SECRET = randomBytes(32).toString('hex');
