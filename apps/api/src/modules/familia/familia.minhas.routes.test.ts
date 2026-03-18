import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('GET /familias/minhas', () => {
  const app = buildApp();
  let validToken: string;

  beforeAll(async () => {
    await app.ready();
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Minhas User', email: 'minhas@example.com', senha: 'password123' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'minhas@example.com', senha: 'password123' },
    });
    validToken = loginRes.json().accessToken;
  });

  afterAll(() => app.close());

  it('retorna 401 sem autenticação', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/minhas',
    });

    expect(res.statusCode).toBe(401);
  });

  it('retorna 200 com array vazio quando usuário não tem famílias', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/minhas',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('familias');
    expect(Array.isArray(body.familias)).toBe(true);
    expect(body.familias).toHaveLength(0);
  });

  it('retorna 200 com famílias do usuário após criar família', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { Authorization: `Bearer ${validToken}` },
      payload: { nome: 'Familia Minhas Teste' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/minhas',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.familias.length).toBeGreaterThanOrEqual(1);

    const familia = body.familias.find((f: { nome: string }) => f.nome === 'Familia Minhas Teste');
    expect(familia).toBeDefined();
    expect(familia).toHaveProperty('id');
    expect(familia).toHaveProperty('nome');
    expect(familia).toHaveProperty('role');
    expect(familia).toHaveProperty('dataEntrada');
    expect(familia.role).toBe('admin');
  });
});
