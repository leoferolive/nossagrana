import { randomBytes } from 'node:crypto';

import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { cabecalhosAutenticados, emitirTokenDeAcesso } from './credenciais-teste.js';

// Segredos gerados em runtime: nenhum literal com formato de chave no repositório.
const segredoAleatorio = () => randomBytes(32).toString('hex');
const SEGREDO_FICTICIO = segredoAleatorio();
const USUARIO = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.test' };
const FAMILIA_ID = '22222222-2222-4222-8222-222222222222';

async function montarAppDeTeste() {
  const app = Fastify();
  await app.register(import('@fastify/jwt'), { secret: SEGREDO_FICTICIO });
  app.get('/eco', async (request) => {
    await request.jwtVerify();
    return { sub: request.user.sub, familia: request.headers['x-familia-id'] };
  });
  return app;
}

describe('credenciais de teste', () => {
  it('emite token aceito pelo verificador JWT com o sub do usuário', async () => {
    const app = await montarAppDeTeste();
    const token = emitirTokenDeAcesso(app, USUARIO);

    const resposta = await app.inject({
      method: 'GET',
      url: '/eco',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(resposta.json()).toMatchObject({ sub: USUARIO.id });
  });

  it('monta authorization e x-familia-id para inject', async () => {
    const app = await montarAppDeTeste();

    const resposta = await app.inject({
      method: 'GET',
      url: '/eco',
      headers: cabecalhosAutenticados(app, USUARIO, FAMILIA_ID),
    });

    expect(resposta.json()).toEqual({ sub: USUARIO.id, familia: FAMILIA_ID });
  });

  it('não emite token com segredo diferente do verificador', async () => {
    const emissor = await montarAppDeTeste();
    const outro = Fastify();
    await outro.register(import('@fastify/jwt'), {
      secret: segredoAleatorio(),
    });
    outro.get('/eco', async (request) => {
      await request.jwtVerify();
      return {};
    });

    const resposta = await outro.inject({
      method: 'GET',
      url: '/eco',
      headers: cabecalhosAutenticados(emissor, USUARIO, FAMILIA_ID),
    });

    expect(resposta.statusCode).toBe(401);
  });
});
