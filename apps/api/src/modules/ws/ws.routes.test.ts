import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('ws.routes — autenticação WebSocket', () => {
  const app = buildApp();
  let validToken: string;

  beforeAll(async () => {
    await app.ready();
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'WS User', email: 'ws-routes@example.com', senha: 'password123' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ws-routes@example.com', senha: 'password123' },
    });
    validToken = loginRes.json().accessToken;
  });

  afterAll(() => app.close());

  it('fecha com 4001 quando token ausente', async () => {
    const ws = await app.injectWS('/api/ws?familiaId=00000000-0000-0000-0000-000000000001');
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code: number) => resolve(code));
    });
    expect(closeCode).toBe(4001);
  });

  it('fecha com 4001 quando token inválido', async () => {
    const ws = await app.injectWS('/api/ws?token=token-invalido&familiaId=00000000-0000-0000-0000-000000000001');
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code: number) => resolve(code));
    });
    expect(closeCode).toBe(4001);
  });

  it('fecha com 4001 quando familiaId ausente', async () => {
    const ws = await app.injectWS(`/api/ws?token=${validToken}`);
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code: number) => resolve(code));
    });
    expect(closeCode).toBe(4001);
  });

  it('conecta com sucesso com token válido e familiaId UUID válido (NODE_ENV=test bypassa membership)', async () => {
    const ws = await app.injectWS(`/api/ws?token=${validToken}&familiaId=00000000-0000-0000-0000-000000000001`);
    const isOpen = ws.readyState === 1;
    ws.close();
    expect(isOpen).toBe(true);
  });
});
