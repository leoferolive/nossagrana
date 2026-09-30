import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('POST /familias/entrar/:codigo (uso único)', () => {
  const app = buildApp();
  const tokens: Record<string, string> = {};
  let familiaId: string;
  let codigo: string;

  async function autenticar(apelido: string): Promise<string> {
    const email = `${apelido}-convite-unico@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: apelido, email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    return login.json().accessToken as string;
  }

  const entrar = (apelido: string, cod = codigo) =>
    app.inject({
      method: 'POST',
      url: `/api/familias/entrar/${cod}`,
      headers: { authorization: `Bearer ${tokens[apelido]}` },
      payload: {},
    });

  beforeAll(async () => {
    await app.ready();
    for (const apelido of ['admin', 'ana', 'bia']) tokens[apelido] = await autenticar(apelido);
    const criada = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${tokens.admin}` },
      payload: { nome: 'Familia Convite Unico' },
    });
    familiaId = criada.json().familia.id;
    const convite = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: { authorization: `Bearer ${tokens.admin}`, 'x-familia-id': familiaId },
      payload: {},
    });
    codigo = convite.json().convite.codigo;
  });

  afterAll(() => app.close());

  it('duas requisições concorrentes: uma recebe 200 e a outra 409', async () => {
    const respostas = await Promise.all([entrar('ana'), entrar('bia')]);

    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const perdedora = respostas.find((r) => r.statusCode === 409)!;
    expect(perdedora.json()).toEqual({ message: 'Convite ja utilizado' });
  });

  it('nova tentativa com o mesmo código continua 409 e não cria membership', async () => {
    const respostas = await Promise.all([entrar('ana'), entrar('bia')]);

    expect(respostas.map((r) => r.statusCode)).toEqual([409, 409]);
  });

  it('código inexistente continua 404 "invalido ou expirado"', async () => {
    const resposta = await entrar('ana', 'NAOEXISTE');

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ message: 'Codigo de convite invalido ou expirado' });
  });
});
