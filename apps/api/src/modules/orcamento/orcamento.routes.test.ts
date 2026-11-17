import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import {
  VerificadorAcessoFamiliaFake,
  subDoAccessToken,
} from '../../shared/familia-access/tests/verificador-acesso-familia.fake.js';

const FAMILIA_ID = '11111111-1111-4111-8111-111111111111';

describe('POST /api/orcamento/:categoriaId — vigência anterior ao limite vigente', () => {
  const verificador = new VerificadorAcessoFamiliaFake();
  const app = buildApp({ verificadorAcessoFamilia: verificador });
  let headers: Record<string, string>;
  let categoriaId: string;

  const definir = (vigenciaInicio: string, valorLimite: string) =>
    app.inject({
      method: 'POST',
      url: `/api/orcamento/${categoriaId}`,
      headers,
      payload: { valorLimite, vigenciaInicio },
    });

  beforeAll(async () => {
    await app.ready();
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Limites', email: 'limites@example.com', senha: 'password123' },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'limites@example.com', senha: 'password123' },
    });
    const token = login.json().accessToken as string;
    verificador.vincular(subDoAccessToken(token), FAMILIA_ID);
    headers = { Authorization: `Bearer ${token}`, 'x-familia-id': FAMILIA_ID };
    const categoria = await app.inject({
      method: 'POST',
      url: '/api/categorias',
      headers,
      payload: { nome: 'Mercado', tipo: 'despesa' },
    });
    categoriaId = categoria.json().categoria.id;
  });

  afterAll(() => app.close());

  it('responde 409 no formato de erro da API, dizendo o mês pedido e o início vigente', async () => {
    expect((await definir('2026-03', '500.00')).statusCode).toBe(200);

    const res = await definir('2026-01', '900.00');

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: {
        message: expect.stringMatching(/2026-01.*2026-03/),
        code: 'LIMITE_VIGENCIA_ANTERIOR',
      },
    });
  });

  it('o limite vigente continua o mesmo depois da recusa', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orcamento/${categoriaId}/historico`,
      headers,
    });

    const { historico } = res.json();
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({
      vigenciaInicio: '2026-03',
      vigenciaFim: null,
      valorLimite: '500.00',
    });
  });
});
