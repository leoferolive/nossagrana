import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('GET /familias/buscar', () => {
  const app = buildApp();
  let validToken: string;

  beforeAll(async () => {
    await app.ready();
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Buscar User', email: 'buscar@example.com', senha: 'password123' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'buscar@example.com', senha: 'password123' },
    });
    validToken = loginRes.json().accessToken;

    // Criar algumas famílias para busca
    await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { Authorization: `Bearer ${validToken}` },
      payload: { nome: 'Familia Silva' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { Authorization: `Bearer ${validToken}` },
      payload: { nome: 'Familia Santos' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { Authorization: `Bearer ${validToken}` },
      payload: { nome: 'Outros Membros' },
    });
  });

  afterAll(() => app.close());

  it('retorna 200 com lista de famílias que contêm o termo no nome', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/buscar?nome=Familia',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('familias');
    expect(Array.isArray(body.familias)).toBe(true);
    const nomes = body.familias.map((f: { id: string; nome: string }) => f.nome);
    expect(nomes.some((n: string) => n.includes('Familia'))).toBe(true);
  });

  it('retorna 401 sem autenticação', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/buscar?nome=Familia',
    });

    expect(res.statusCode).toBe(401);
  });

  it('retorna 400 sem o parâmetro nome', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/buscar',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('retorna 400 com nome vazio', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/buscar?nome=',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('cada item da lista tem id e nome', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/familias/buscar?nome=Familia',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const familia of body.familias) {
      expect(familia).toHaveProperty('id');
      expect(familia).toHaveProperty('nome');
      expect(typeof familia.id).toBe('string');
      expect(typeof familia.nome).toBe('string');
    }
  });
});
