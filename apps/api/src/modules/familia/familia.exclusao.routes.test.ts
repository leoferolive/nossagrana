import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

type ClienteWs = Awaited<ReturnType<ReturnType<typeof buildApp>['injectWS']>>;

describe('DELETE /familias/:id — convites e sockets (#66)', () => {
  const app = buildApp();
  let token: string;
  let familiaId: string;
  let outraFamiliaId: string;

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

  // Não discrimina a invalidação: o repositório InMemory apaga os convites fisicamente. A
  // cobertura real (expira_em gravado na mesma transação) está em db/tests/exclusao-familia.pg.test.ts.
  it('convite pendente da família excluída deixa de ser aceito e não cria membership', async () => {
    const propria = await criarFamilia('Familia Com Convite');
    const propriosHeaders = { authorization: `Bearer ${token}`, 'x-familia-id': propria };
    const convite = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: propriosHeaders,
      payload: {},
    });
    const codigoProprio = convite.json().convite.codigo as string;
    await app.inject({
      method: 'DELETE',
      url: `/api/familias/${propria}`,
      headers: propriosHeaders,
    });

    const resposta = await app.inject({
      method: 'POST',
      url: `/api/familias/entrar/${codigoProprio}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(resposta.statusCode).toBe(404);
  });

  it('listener do evento que lança não transforma a exclusão gravada em 500', async () => {
    const propria = await criarFamilia('Familia Listener Falho');
    const listenerFalho = () => {
      throw new Error('listener quebrado');
    };
    app.eventBus!.on('familia:excluida', listenerFalho);

    try {
      const exclusao = await app.inject({
        method: 'DELETE',
        url: `/api/familias/${propria}`,
        headers: { authorization: `Bearer ${token}`, 'x-familia-id': propria },
      });

      expect(exclusao.statusCode).toBe(204);
    } finally {
      app.eventBus!.off('familia:excluida', listenerFalho);
    }
  });
});
