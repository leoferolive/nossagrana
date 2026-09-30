import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';
import { InMemoryFamiliaRepository } from './familia.repository.js';

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

  it('nova tentativa: quem entrou recebe 200 sem duplicar vínculo; o perdedor segue 409', async () => {
    const primeira = await Promise.all([entrar('ana'), entrar('bia')]);
    const [vencedor, perdedor] = primeira[0]!.statusCode === 200 ? ['ana', 'bia'] : ['bia', 'ana'];

    const repeticao = await Promise.all([entrar(vencedor!), entrar(perdedor!)]);

    expect(repeticao.map((r) => r.statusCode)).toEqual([200, 409]);
    const lista = await app.inject({
      method: 'GET',
      url: `/api/familias/${familiaId}/membros`,
      headers: { authorization: `Bearer ${tokens.admin}`, 'x-familia-id': familiaId },
    });
    const papeis = (lista.json().membros as Array<{ role: string }>).map((m) => m.role).sort();
    expect(papeis).toEqual(['admin', 'membro']);
  });

  it('código inexistente continua 404 "invalido ou expirado"', async () => {
    const resposta = await entrar('ana', 'NAOEXISTE');

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ message: 'Codigo de convite invalido ou expirado' });
  });
});

describe('POST /familias/convites (família excluída no meio da criação, #147)', () => {
  const app = buildApp();

  afterAll(() => app.close());

  it('repositório que recusa o convite: 404 com { message } e sem criar convite', async () => {
    await app.ready();
    const email = 'admin-convite-404@example.com';
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Admin 404', email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    const token = login.json().accessToken as string;
    const criada = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Familia Corrida' },
    });
    const familiaId = criada.json().familia.id as string;
    const recusa = vi
      .spyOn(InMemoryFamiliaRepository.prototype, 'createInvite')
      .mockResolvedValueOnce(null);

    const resposta = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: { authorization: `Bearer ${token}`, 'x-familia-id': familiaId },
      payload: {},
    });

    expect(recusa).toHaveBeenCalledTimes(1);
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ message: 'Familia nao encontrada' });
    recusa.mockRestore();
  });
});
