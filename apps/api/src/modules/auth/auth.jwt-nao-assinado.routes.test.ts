import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

type App = ReturnType<typeof buildApp>;

const base64Url = (valor: object): string =>
  Buffer.from(JSON.stringify(valor)).toString('base64url');

const payloadForjado = (): object => ({
  sub: '00000000-0000-0000-0000-000000000001',
  email: 'forjado@example.com',
  exp: Math.floor(Date.now() / 1000) + 600,
});

/** Regressão das advisories do fast-jwt (token sem assinatura / HS256 forjado). */
describe('JWT forjado em rota protegida', () => {
  let app: App;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const acessarMe = (token: string) =>
    app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

  it('rejeita token com alg none e sem assinatura', async () => {
    const token = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payloadForjado())}.`;

    expect((await acessarMe(token)).statusCode).toBe(401);
  });

  it('rejeita token HS256 com assinatura inválida', async () => {
    const token = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payloadForjado())}.assinatura-invalida`;

    expect((await acessarMe(token)).statusCode).toBe(401);
  });
});
