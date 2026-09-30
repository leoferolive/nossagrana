import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

type App = ReturnType<typeof buildApp>;

const SENHA = 'senha12345';
const FAMILIA = '00000000-0000-4000-8000-000000000118';
const OUTRA_FAMILIA = '00000000-0000-4000-8000-000000000218';

let contador = 0;

async function criarUsuario(app: App) {
  contador += 1;
  const email = `ws-ticket-${contador}@example.com`;
  const registro = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { nome: `Usuario ${contador}`, email, senha: SENHA },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha: SENHA },
  });
  const { accessToken } = login.json() as { accessToken: string };
  return { id: registro.json().user.id as string, accessToken };
}

const pedirTicket = (app: App, accessToken: string | null, familiaId: string | null = FAMILIA) =>
  app.inject({
    method: 'POST',
    url: '/api/ws/ticket',
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(familiaId ? { 'x-familia-id': familiaId } : {}),
    },
  });

describe('POST /api/ws/ticket (#118)', () => {
  let app: App;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });

  afterEach(() => app.close());

  it('emite ticket de uso único vinculado a usuário, família e sessão', async () => {
    const ana = await criarUsuario(app);

    const resposta = await pedirTicket(app, ana.accessToken);

    expect(resposta.statusCode).toBe(200);
    const { ticket, expiraEm } = resposta.json() as { ticket: string; expiraEm: string };
    expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(expiraEm).getTime()).toBeGreaterThan(Date.now());
    const dados = await app.wsTickets.consumir(ticket, FAMILIA);
    expect(dados).toMatchObject({ userId: ana.id, familiaId: FAMILIA });
    expect(dados?.emitidoEm).toEqual(expect.any(Number));
  });

  it('cada chamada emite um ticket novo', async () => {
    const ana = await criarUsuario(app);

    const primeiro = await pedirTicket(app, ana.accessToken);
    const segundo = await pedirTicket(app, ana.accessToken);

    expect(primeiro.json().ticket).not.toBe(segundo.json().ticket);
  });

  it('o ticket de uma família não vale para outra', async () => {
    const ana = await criarUsuario(app);
    const { ticket } = (await pedirTicket(app, ana.accessToken, FAMILIA)).json();

    expect(await app.wsTickets.consumir(ticket, OUTRA_FAMILIA)).toBeNull();
  });

  it('a resposta não contém JWT', async () => {
    const ana = await criarUsuario(app);

    const resposta = await pedirTicket(app, ana.accessToken);

    expect(resposta.body).not.toContain(ana.accessToken);
    expect(resposta.body).not.toContain('eyJ');
  });

  it('401 sem autenticação, sem emitir ticket', async () => {
    const resposta = await pedirTicket(app, null);

    expect(resposta.statusCode).toBe(401);
  });

  it('401 com access inválido', async () => {
    const resposta = await pedirTicket(app, 'token-invalido');

    expect(resposta.statusCode).toBe(401);
  });

  it('400 sem o header x-familia-id', async () => {
    const ana = await criarUsuario(app);

    const resposta = await pedirTicket(app, ana.accessToken, null);

    expect(resposta.statusCode).toBe(400);
  });

  it('400 com x-familia-id que não é UUID', async () => {
    const ana = await criarUsuario(app);

    const resposta = await pedirTicket(app, ana.accessToken, 'nao-e-uuid');

    expect(resposta.statusCode).toBe(400);
  });

  it('sessão revogada não obtém ticket: 401 SESSION_REVOKED', async () => {
    const ana = await criarUsuario(app);
    await app.sessoes.revogarTodas(ana.id);

    const resposta = await pedirTicket(app, ana.accessToken);

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({
      error: { code: 'SESSION_REVOKED' },
    });
  });

  it('falha ao consultar a revogação: falha fechada (500), sem ticket', async () => {
    const ana = await criarUsuario(app);
    app.repositoriosInMemory!.tokensRevogados.findRevokedAllAt = async () => {
      throw new Error('armazenamento indisponível');
    };

    const resposta = await pedirTicket(app, ana.accessToken);

    expect(resposta.statusCode).toBe(500);
  });
});
