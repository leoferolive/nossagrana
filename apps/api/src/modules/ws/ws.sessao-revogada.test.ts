import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';

type App = ReturnType<typeof buildApp>;
type ClienteWs = Awaited<ReturnType<App['injectWS']>>;

const SENHA = 'senha12345';
const NOVA_SENHA = 'outraSenha678';

interface Usuario {
  id: string;
  email: string;
  accessToken: string;
}

let contador = 0;

async function criarUsuario(app: App): Promise<Usuario> {
  contador += 1;
  const email = `ws-sessao-${contador}@example.com`;
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
  return { id: registro.json().user.id as string, email, accessToken };
}

const fechamento = (ws: ClienteWs) =>
  new Promise<number>((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('socket permaneceu aberto')), 2000);
    ws.on('close', (code: number) => {
      clearTimeout(limite);
      resolve(code);
    });
  });

const conectar = (app: App, token: string, familiaId: string) =>
  app.injectWS(`/api/ws?token=${token}&familiaId=${familiaId}`);

const trocarSenha = (app: App, usuario: Usuario) =>
  app.inject({
    method: 'PATCH',
    url: '/api/auth/senha',
    payload: { senhaAtual: SENHA, novaSenha: NOVA_SENHA },
    headers: { authorization: `Bearer ${usuario.accessToken}` },
  });

describe('WebSocket — sessão revogada (#119)', () => {
  let app: App;
  let familiaId: string;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
    familiaId = '00000000-0000-4000-8000-000000000119';
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('fecha com 4005 os sockets do usuário que trocou a senha, em todas as famílias, e só os dele', async () => {
    const ana = await criarUsuario(app);
    const bruno = await criarUsuario(app);
    const outraFamilia = '00000000-0000-4000-8000-000000000120';
    const anaF1 = await conectar(app, ana.accessToken, familiaId);
    const anaF2 = await conectar(app, ana.accessToken, outraFamilia);
    const brunoF1 = await conectar(app, bruno.accessToken, familiaId);
    const fechamentosDaAna = [fechamento(anaF1), fechamento(anaF2)];

    const troca = await trocarSenha(app, ana);

    expect(troca.statusCode).toBe(204);
    expect(await Promise.all(fechamentosDaAna)).toEqual([4005, 4005]);
    expect(brunoF1.readyState).toBe(1);
    expect(app.wsManager.roomSize(familiaId)).toBe(1);
    expect(app.wsManager.roomSize(outraFamilia)).toBe(0);
    brunoF1.close();
  });

  it('o access emitido antes da troca não reconecta: handshake recusado com 4005', async () => {
    const ana = await criarUsuario(app);
    await trocarSenha(app, ana);

    const ws = await conectar(app, ana.accessToken, familiaId);

    expect(await fechamento(ws)).toBe(4005);
    expect(app.wsManager.roomSize(familiaId)).toBe(0);
  });

  it('depois de um novo login o usuário volta a conectar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    const ana = await criarUsuario(app);
    await trocarSenha(app, ana);

    vi.setSystemTime(new Date('2026-09-30T10:00:05Z'));
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ana.email, senha: NOVA_SENHA },
    });
    const ws = await conectar(app, login.json().accessToken as string, familiaId);

    expect(ws.readyState).toBe(1);
    ws.close();
  });

  it('revogação gravada entre a 1ª checagem e o join: a 2ª checagem (já no room) fecha com 4005', async () => {
    const ana = await criarUsuario(app);
    const tokens = app.repositoriosInMemory!.tokensRevogados;
    await tokens.revokeAllByUserId(ana.id);
    // A 1ª checagem ainda não vê a revogação (gravada "depois" dela); a 2ª vê.
    vi.spyOn(tokens, 'findRevokedAllAt').mockResolvedValueOnce(null);

    const ws = await conectar(app, ana.accessToken, familiaId);

    expect(await fechamento(ws)).toBe(4005);
    expect(app.wsManager.roomSize(familiaId)).toBe(0);
  });

  it('falha ao consultar a revogação: falha fechada (1011), sem ficar no room', async () => {
    const ana = await criarUsuario(app);
    vi.spyOn(app.repositoriosInMemory!.tokensRevogados, 'findRevokedAllAt').mockRejectedValue(
      new Error('armazenamento indisponível'),
    );

    const ws = await conectar(app, ana.accessToken, familiaId);

    expect(await fechamento(ws)).toBe(1011);
    expect(app.wsManager.roomSize(familiaId)).toBe(0);
  });
});

describe('WebSocket — membro removido (#119)', () => {
  let app: App;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });

  afterEach(() => app.close());

  async function familiaComMembro() {
    const admin = await criarUsuario(app);
    const membro = await criarUsuario(app);
    const criada = await app.inject({
      method: 'POST',
      url: '/api/familias',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { nome: 'Familia WS' },
    });
    const familiaId = criada.json().familia.id as string;
    const convite = await app.inject({
      method: 'POST',
      url: '/api/familias/convites',
      headers: { authorization: `Bearer ${admin.accessToken}`, 'x-familia-id': familiaId },
      payload: {},
    });
    await app.inject({
      method: 'POST',
      url: `/api/familias/entrar/${convite.json().convite.codigo}`,
      headers: { authorization: `Bearer ${membro.accessToken}` },
      payload: {},
    });
    return { admin, membro, familiaId };
  }

  const removerMembro = (admin: Usuario, membro: Usuario, familiaId: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/familias/${familiaId}/membros/${membro.id}`,
      headers: { authorization: `Bearer ${admin.accessToken}`, 'x-familia-id': familiaId },
    });

  it('fecha com 4006 só os sockets do membro removido naquela família', async () => {
    const { admin, membro, familiaId } = await familiaComMembro();
    const outraFamilia = '00000000-0000-4000-8000-000000000121';
    const doMembro = await conectar(app, membro.accessToken, familiaId);
    const doMembroEmOutra = await conectar(app, membro.accessToken, outraFamilia);
    const doAdmin = await conectar(app, admin.accessToken, familiaId);
    const fechamentoDoMembro = fechamento(doMembro);

    const remocao = await removerMembro(admin, membro, familiaId);

    expect(remocao.statusCode).toBe(204);
    expect(await fechamentoDoMembro).toBe(4006);
    expect(doMembroEmOutra.readyState).toBe(1);
    expect(doAdmin.readyState).toBe(1);
    doMembroEmOutra.close();
    doAdmin.close();
  });

  it('remoção recusada (membro tentando remover o admin) não fecha nenhum socket', async () => {
    const { admin, membro, familiaId } = await familiaComMembro();
    const doAdmin = await conectar(app, admin.accessToken, familiaId);

    const remocao = await removerMembro(membro, admin, familiaId);

    expect(remocao.statusCode).toBe(403);
    expect(doAdmin.readyState).toBe(1);
    doAdmin.close();
  });
});
