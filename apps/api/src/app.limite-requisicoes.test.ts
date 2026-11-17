import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

// O app de teste desliga o limite de requisições (NODE_ENV=test); aqui ele é
// ligado de propósito. /auth/login tem limite próprio de 5 por minuto.
describe('limite de requisições', () => {
  const app = buildApp({ limiteDeRequisicoes: true });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const tentarLogin = () =>
    app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ninguem@example.com', senha: 'senha-errada-123' },
    });

  it('responde 429 no formato de erro da API, com retry-after, ao estourar o limite do login', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await tentarLogin()).statusCode).not.toBe(429);
    }

    const resposta = await tentarLogin();

    expect(resposta.statusCode).toBe(429);
    const corpo = resposta.json<{ error: { message: string; code?: string } }>();
    expect(corpo.error.message).toMatch(/^Muitas tentativas\. Tente novamente em \d+ segundos\.$/);
    expect(corpo.error.code).toBe('LIMITE_REQUISICOES');
    expect(Number(resposta.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('não limita o health check', async () => {
    for (let i = 0; i < 6; i += 1) {
      const resposta = await app.inject({ method: 'GET', url: '/api/health' });
      expect(resposta.statusCode).toBe(200);
    }
  });
});
