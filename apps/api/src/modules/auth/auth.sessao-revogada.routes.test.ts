import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../app.js';

const SENHA = 'senha12345';
const NOVA_SENHA = 'outraSenha678';

type App = ReturnType<typeof buildApp>;

interface Sessao {
  accessToken: string;
  refreshToken: string;
}

let contadorEmail = 0;

async function registrarELogar(app: App): Promise<{ email: string; sessao: Sessao }> {
  contadorEmail += 1;
  const email = `sessao-revogada-${contadorEmail}@example.com`;
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { nome: 'Usuario Sessao', email, senha: SENHA },
  });
  return { email, sessao: await logar(app, email, SENHA) };
}

async function logar(app: App, email: string, senha: string): Promise<Sessao> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha },
  });
  return resposta.json() as Sessao;
}

const trocarSenha = (app: App, accessToken: string, senhaAtual = SENHA) =>
  app.inject({
    method: 'PATCH',
    url: '/api/auth/senha',
    payload: { senhaAtual, novaSenha: NOVA_SENHA },
    headers: { authorization: `Bearer ${accessToken}` },
  });

const refresh = (app: App, refreshToken: string) =>
  app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken } });

describe('sessões revogadas na troca de senha (#119)', () => {
  let app: App;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('refresh emitido antes da troca de senha retorna 401 (SESSION_REVOKED)', async () => {
    const { sessao } = await registrarELogar(app);

    const troca = await trocarSenha(app, sessao.accessToken);
    const resposta = await refresh(app, sessao.refreshToken);

    expect(troca.statusCode).toBe(204);
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({ code: 'SESSION_REVOKED' });
  });

  it('refresh rotacionado antes da troca de senha também morre (todos os dispositivos)', async () => {
    const { email, sessao } = await registrarELogar(app);
    const outroDispositivo = await logar(app, email, SENHA);
    const rotacionado = (await refresh(app, sessao.refreshToken)).json() as Sessao;

    await trocarSenha(app, sessao.accessToken);

    expect((await refresh(app, rotacionado.refreshToken)).statusCode).toBe(401);
    expect((await refresh(app, outroDispositivo.refreshToken)).statusCode).toBe(401);
  });

  it('login depois da troca gera sessão válida: o refresh funciona e rotaciona', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    const { email, sessao } = await registrarELogar(app);
    await trocarSenha(app, sessao.accessToken);

    vi.setSystemTime(new Date('2026-09-30T10:00:05Z'));
    const novaSessao = await logar(app, email, NOVA_SENHA);
    vi.setSystemTime(new Date('2026-09-30T10:10:00Z'));
    const renovada = await refresh(app, novaSessao.refreshToken);

    expect(renovada.statusCode).toBe(200);
    const proximo = await refresh(app, (renovada.json() as Sessao).refreshToken);
    expect(proximo.statusCode).toBe(200);
  });

  it('o access já emitido segue válido até expirar (janela de 15 min documentada)', async () => {
    const { sessao } = await registrarELogar(app);

    await trocarSenha(app, sessao.accessToken);
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${sessao.accessToken}` },
    });

    expect(me.statusCode).toBe(200);
  });

  it('senha atual incorreta responde 401 e não revoga as sessões', async () => {
    const { sessao } = await registrarELogar(app);

    const troca = await trocarSenha(app, sessao.accessToken, 'errada-123');

    expect(troca.statusCode).toBe(401);
    expect((await refresh(app, sessao.refreshToken)).statusCode).toBe(200);
  });

  it('não devolve senha nem token na resposta da troca', async () => {
    const { sessao } = await registrarELogar(app);

    const troca = await trocarSenha(app, sessao.accessToken);

    expect(troca.body).toBe('');
    expect(troca.headers['set-cookie']).toBeUndefined();
  });

  it('falha ao gravar a revogação vira 500, não "senha atual incorreta"', async () => {
    const { sessao } = await registrarELogar(app);
    vi.spyOn(app.repositoriosInMemory!.tokensRevogados, 'revokeAllByUserId').mockRejectedValue(
      new Error('armazenamento indisponível'),
    );

    const troca = await trocarSenha(app, sessao.accessToken);

    expect(troca.statusCode).toBe(500);
  });

  it('refresh concorrente à revogação: se a revogação chega no meio da rotação, nenhum token novo sobrevive', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
    const { sessao } = await registrarELogar(app);
    const tokens = app.repositoriosInMemory!.tokensRevogados;
    const revogarToken = tokens.revokeToken.bind(tokens);
    // A revogação global chega exatamente entre a checagem do refresh e a emissão do novo par.
    vi.spyOn(tokens, 'revokeToken').mockImplementationOnce(async (...args) => {
      await revogarToken(...args);
      vi.setSystemTime(new Date('2026-09-30T10:00:01Z'));
      await trocarSenha(app, sessao.accessToken);
      vi.setSystemTime(new Date('2026-09-30T10:00:02Z'));
    });

    const resposta = await refresh(app, sessao.refreshToken);

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toMatchObject({ code: 'SESSION_REVOKED' });
  });
});
