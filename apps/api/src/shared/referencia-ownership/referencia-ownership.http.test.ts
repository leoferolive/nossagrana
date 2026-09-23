import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

/**
 * Contrato HTTP da validação de ownership (#55): rotas reais, com o repositório
 * InMemory de referências vazio — todo ID recebido é "de outra família".
 */
describe('Referências de outra família nas rotas financeiras', () => {
  const app = buildApp();
  const familiaId = randomUUID();
  const categoriaDeOutraFamilia = randomUUID();
  let token: string;

  const headers = () => ({ Authorization: `Bearer ${token}`, 'x-familia-id': familiaId });

  beforeAll(async () => {
    await app.ready();
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Ownership', email: 'ownership@example.com', senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ownership@example.com', senha: 'password123' },
    });
    token = login.json().accessToken;
  });

  afterAll(() => app.close());

  it('POST /api/transacoes responde 422 e não cria a transação', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: headers(),
      payload: {
        tipo: 'despesa',
        valor: '10.00',
        categoriaId: categoriaDeOutraFamilia,
        data: '2026-03-10',
      },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'REFERENCIA_INVALIDA' });
    expect(res.json().message).toContain(categoriaDeOutraFamilia);

    const lista = await app.inject({ method: 'GET', url: '/api/transacoes', headers: headers() });
    expect(lista.json().transacoes).toEqual([]);
  });

  it('categoria criada pela família A é aceita em A e rejeitada em B', async () => {
    const familiaB = randomUUID();
    const criada = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers: headers(),
      payload: { nome: 'Mercado', tipo: 'despesa' },
    });
    const categoriaA = criada.json().categoria.id as string;
    const transacao = {
      tipo: 'despesa',
      valor: '10.00',
      categoriaId: categoriaA,
      data: '2026-03-10',
    };

    const emA = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: headers(),
      payload: transacao,
    });
    const emB = await app.inject({
      method: 'POST',
      url: '/api/transacoes',
      headers: { ...headers(), 'x-familia-id': familiaB },
      payload: transacao,
    });

    expect(emA.statusCode).toBe(201);
    expect(emB.statusCode).toBe(422);
    expect(emB.json().message).not.toContain(familiaId);
    const listaB = await app.inject({
      method: 'GET',
      url: '/api/transacoes',
      headers: { ...headers(), 'x-familia-id': familiaB },
    });
    expect(listaB.json().transacoes).toEqual([]);
  });

  it('POST /api/orcamento/:categoriaId responde 422 para categoria de outra família', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/orcamento/${categoriaDeOutraFamilia}`,
      headers: headers(),
      payload: { valorLimite: '100.00', vigenciaInicio: '2026-03' },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'REFERENCIA_INVALIDA' });
  });

  it('POST /api/templates-transacao responde 422 para método de outra família', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates-transacao',
      headers: headers(),
      payload: { nome: 'Luz', tipo: 'despesa', metodoPagamentoId: randomUUID() },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'REFERENCIA_INVALIDA' });
  });
});
