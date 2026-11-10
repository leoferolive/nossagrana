import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { WS_CLOSE_ERRO_INTERNO } from './modules/ws/ws-close-codes.js';
import {
  VerificadorAcessoFamiliaFake,
  subDoAccessToken,
} from './shared/familia-access/tests/verificador-acesso-familia.fake.js';

// Regressão #79: NODE_ENV=test (que é o ambiente deste arquivo) NÃO libera família alheia.
type App = ReturnType<typeof buildApp>;

const FAMILIA_PROPRIA = '00000000-0000-4000-8000-0000000000a1';
const FAMILIA_ALHEIA = '00000000-0000-4000-8000-0000000000b2';
const SENHA = 'password123';

async function registrarELogar(app: App): Promise<string> {
  const email = 'autorizacao-79@example.com';
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { nome: 'Ana', email, senha: SENHA },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: SENHA },
  });
  return login.json().accessToken as string;
}

const listarCategorias = (app: App, token: string, familiaId: string) =>
  app.inject({
    method: 'GET',
    url: '/api/categorias',
    headers: { authorization: `Bearer ${token}`, 'x-familia-id': familiaId },
  });

describe('autorização por família não depende de NODE_ENV (#79)', () => {
  let verificador: VerificadorAcessoFamiliaFake;
  let app: App;
  let token: string;

  beforeEach(async () => {
    verificador = new VerificadorAcessoFamiliaFake();
    app = buildApp({ verificadorAcessoFamilia: verificador });
    await app.ready();
    token = await registrarELogar(app);
    verificador.vincular(subDoAccessToken(token), FAMILIA_PROPRIA);
  });

  afterEach(() => app.close());

  it('HTTP: membro acessa a própria família', async () => {
    expect((await listarCategorias(app, token, FAMILIA_PROPRIA)).statusCode).toBe(200);
  });

  it('HTTP: família alheia recebe 403 FAMILIA_SEM_ACESSO', async () => {
    const resposta = await listarCategorias(app, token, FAMILIA_ALHEIA);

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ error: { code: 'FAMILIA_SEM_ACESSO' } });
  });

  it('HTTP: falha do verificador vira 403, nunca 200 nem erro silencioso', async () => {
    verificador.falharCom(new Error('banco indisponível'));

    const resposta = await listarCategorias(app, token, FAMILIA_PROPRIA);

    expect(resposta.statusCode).toBe(403);
    expect(resposta.json()).toMatchObject({ error: { code: 'FAMILIA_ACESSO_INDISPONIVEL' } });
  });

  it('HTTP: sem token a rota protegida devolve 401', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: '/api/categorias',
      headers: { 'x-familia-id': FAMILIA_PROPRIA },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it('HTTP: POST /ws/ticket para família alheia recebe 403', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/ws/ticket',
      headers: { authorization: `Bearer ${token}`, 'x-familia-id': FAMILIA_ALHEIA },
    });

    expect(resposta.statusCode).toBe(403);
  });

  async function conectarComTicketDe(familiaId: string) {
    const { ticket } = await app.wsTickets.emitir({
      userId: subDoAccessToken(token),
      familiaId,
      emitidoEm: undefined,
    });
    return app.injectWS(`/api/ws?ticket=${ticket}&familiaId=${familiaId}`);
  }

  const fechamentoDe = (ws: Awaited<ReturnType<typeof conectarComTicketDe>>) =>
    new Promise<number>((resolve) => ws.on('close', (codigo: number) => resolve(codigo)));

  it('WS: ticket de família alheia fecha com 4003 e não entra no room', async () => {
    const ws = await conectarComTicketDe(FAMILIA_ALHEIA);

    expect(await fechamentoDe(ws)).toBe(4003);
    expect(app.wsManager.roomSize(FAMILIA_ALHEIA)).toBe(0);
  });

  it('WS: falha do verificador fecha com 1011', async () => {
    verificador.falharCom(new Error('banco indisponível'));

    const ws = await conectarComTicketDe(FAMILIA_PROPRIA);

    expect(await fechamentoDe(ws)).toBe(WS_CLOSE_ERRO_INTERNO);
    expect(app.wsManager.roomSize(FAMILIA_PROPRIA)).toBe(0);
  });

  it('WS: membro conecta na própria família', async () => {
    const ws = await conectarComTicketDe(FAMILIA_PROPRIA);

    expect(ws.readyState).toBe(1);
    expect(app.wsManager.roomSize(FAMILIA_PROPRIA)).toBe(1);
    ws.close();
  });
});
