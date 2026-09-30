import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

type ClienteWs = Awaited<ReturnType<ReturnType<typeof buildApp>['injectWS']>>;

describe('DELETE /familias/:id — convites e sockets (#66)', () => {
  const app = buildApp();
  let token: string;
  let familiaId: string;
  let outraFamiliaId: string;
  let codigo: string;

  const autenticado = () => ({ authorization: `Bearer ${token}`, 'x-familia-id': familiaId });

  const fechamento = (ws: ClienteWs) =>
    new Promise<number>((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error('socket permaneceu aberto')), 2000);
      ws.on('close', (code: number) => {
        clearTimeout(limite);
        resolve(code);
      });
    });

  async function criarFamilia(nome: string): Promise<string> {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome },
    });
    return resposta.json().familia.id as string;
  }

  const conectar = (id: string) => app.injectWS(`/api/ws?token=${token}&familiaId=${id}`);

  beforeAll(async () => {
    await app.ready();
    const email = 'exclusao-familia@example.com';
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Admin Exclusao', email, senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, senha: 'password123' },
    });
    token = login.json().accessToken as string;
    familiaId = await criarFamilia('Familia Excluida');
    outraFamiliaId = await criarFamilia('Familia Mantida');
    const convite = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: autenticado(),
      payload: {},
    });
    codigo = convite.json().convite.codigo;
  });

  afterAll(() => app.close());

  it('fecha todos os sockets da família excluída com 4004 e mantém os de outra família', async () => {
    const sockets = [await conectar(familiaId), await conectar(familiaId)];
    const outra = await conectar(outraFamiliaId);
    const fechamentos = sockets.map(fechamento);

    const exclusao = await app.inject({
      method: 'DELETE',
      url: `/api/familias/${familiaId}`,
      headers: autenticado(),
    });

    expect(exclusao.statusCode).toBe(204);
    expect(await Promise.all(fechamentos)).toEqual([4004, 4004]);
    expect(outra.readyState).toBe(1);
    outra.close();
  });

  it('convite pendente da família excluída deixa de ser aceito e não cria membership', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/familias/entrar/${codigo}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(resposta.statusCode).toBe(404);
  });
});
