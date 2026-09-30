import { Writable } from 'node:stream';

import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DrizzleRevokedTokenRepository,
  InMemoryRevokedTokenRepository,
} from '../modules/auth/revoked-token.repository.js';
import { sessaoRevogacaoPlugin } from './sessao-revogacao.plugin.js';
import { websocketPlugin } from './websocket.plugin.js';

const envDoTeste = vi.hoisted(() => ({ NODE_ENV: 'test' }));

vi.mock('../config/env.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config/env.js')>();
  const env = new Proxy(original.env, {
    get: (alvo, chave) => (chave === 'NODE_ENV' ? envDoTeste.NODE_ENV : Reflect.get(alvo, chave)),
  });
  return { ...original, env };
});

function capturaDeLogs(linhas: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, done) {
      linhas.push(String(chunk));
      done();
    },
  });
}

describe('sessaoRevogacaoPlugin', () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    envDoTeste.NODE_ENV = 'test';
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  function novoApp(linhasDeLog?: string[]) {
    const app = linhasDeLog
      ? Fastify({ logger: { level: 'warn', stream: capturaDeLogs(linhasDeLog) } })
      : Fastify();
    apps.push(app);
    return app;
  }

  it('usa o repositório injetado em `tokensRevogados` e em `sessoes`', async () => {
    const repo = new InMemoryRevokedTokenRepository();
    const app = novoApp();
    await app.register(websocketPlugin);
    await app.register(sessaoRevogacaoPlugin, { tokensRevogados: repo });
    await app.ready();

    await app.sessoes.revogarTodas('u1');

    expect(app.tokensRevogados).toBe(repo);
    expect(await repo.findRevokedAllAt('u1')).not.toBeNull();
  });

  it('em NODE_ENV=test usa o repositório InMemory da instância', async () => {
    const app = novoApp();
    await app.register(websocketPlugin);
    await app.register(sessaoRevogacaoPlugin);
    await app.ready();

    expect(app.tokensRevogados).toBeInstanceOf(InMemoryRevokedTokenRepository);
  });

  it('fora de test usa o repositório Drizzle', async () => {
    envDoTeste.NODE_ENV = 'production';
    const app = novoApp();
    await app.register(websocketPlugin);
    await app.register(sessaoRevogacaoPlugin);
    await app.ready();

    expect(app.tokensRevogados).toBeInstanceOf(DrizzleRevokedTokenRepository);
  });

  it('sem eventBus avisa no log e revogar não lança (não há sockets a fechar)', async () => {
    const linhas: string[] = [];
    const app = novoApp(linhas);
    await app.register(sessaoRevogacaoPlugin, {
      tokensRevogados: new InMemoryRevokedTokenRepository(),
    });
    await app.ready();

    await expect(app.sessoes.revogarTodas('u1')).resolves.toBeUndefined();

    expect(linhas.join('')).toContain('eventBus ausente');
  });
});
