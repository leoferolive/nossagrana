import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';

import {
  CABECALHO_CSRF,
  lerRefreshEmitido,
  lerSetCookie,
  logarComCookie,
  logoutComCookie,
  NOME_COOKIE_PROD,
  refreshComCookie,
  registrarELogarComCookie,
} from './tests/sessao-cookie.js';

type App = ReturnType<typeof buildApp>;

let contador = 0;
const novoEmail = () => `cookie-${(contador += 1)}@example.com`;

describe('refresh token em cookie HttpOnly (#116)', () => {
  let app: App;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    env.NODE_ENV = 'test';
    env.REFRESH_TOKEN_BODY_FALLBACK = false;
    await app.close();
  });

  describe('atributos do cookie', () => {
    it('login emite cookie HttpOnly, SameSite=Strict, Path mínimo, sem Secure fora de produção', async () => {
      const { resposta } = await registrarELogarComCookie(app, novoEmail());

      const [cookie] = lerSetCookie(resposta);
      expect(cookie).toMatch(/^ng_refresh=/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/auth');
      expect(cookie).not.toContain('Secure');
      expect(cookie).not.toContain('Domain');
    });

    it('em produção o cookie é Secure e usa o prefixo __Secure-', async () => {
      const email = novoEmail();
      await registrarELogarComCookie(app, email);
      env.NODE_ENV = 'production';

      const resposta = await logarComCookie(app, email, 'senha12345');

      const [cookie] = lerSetCookie(resposta);
      expect(cookie).toMatch(new RegExp(`^${NOME_COOKIE_PROD}=`));
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
    });

    it('Max-Age acompanha a validade do refresh (7 dias)', async () => {
      const { resposta } = await registrarELogarComCookie(app, novoEmail());

      const maxAge = Number(/Max-Age=(\d+)/.exec(lerSetCookie(resposta)[0] ?? '')?.[1]);
      expect(maxAge).toBeGreaterThan(7 * 24 * 3600 - 60);
      expect(maxAge).toBeLessThanOrEqual(7 * 24 * 3600);
    });

    it('o refresh token não aparece no JSON do login', async () => {
      const { resposta } = await registrarELogarComCookie(app, novoEmail());

      expect(resposta.json()).toEqual({ accessToken: expect.any(String) });
    });
  });

  describe('refresh e rotação', () => {
    it('renova pelo cookie, rotaciona o cookie e não devolve refresh no JSON', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const resposta = await refreshComCookie(app, refresh);

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ accessToken: expect.any(String) });
      const novo = lerRefreshEmitido(resposta);
      expect(novo).toBeTruthy();
      expect(novo).not.toBe(refresh);
    });

    it('replay do refresh antigo é detectado e revoga também o cookie novo', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());
      const rotacionado = lerRefreshEmitido(await refreshComCookie(app, refresh)) ?? '';

      const replay = await refreshComCookie(app, refresh);
      const novoDepoisDoReplay = await refreshComCookie(app, rotacionado);

      expect(replay.statusCode).toBe(401);
      expect(replay.json()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
      expect(novoDepoisDoReplay.statusCode).toBe(401);
    });

    it('cookie expirado retorna 401 e limpa o cookie', async () => {
      const expirado = app.jwt.sign(
        { sub: 'u1', email: 'a@b.c', tokenType: 'refresh' },
        { expiresIn: -10, key: env.REFRESH_TOKEN_SECRET },
      );

      const resposta = await refreshComCookie(app, expirado);

      expect(resposta.statusCode).toBe(401);
      expect(lerSetCookie(resposta)[0]).toMatch(/^ng_refresh=;/);
    });

    it('access token no cookie não vale como refresh', async () => {
      const acesso = app.jwt.sign({ sub: 'u1', email: 'a@b.c' });

      const resposta = await refreshComCookie(app, acesso);

      expect(resposta.statusCode).toBe(401);
    });

    it('sem cookie e sem corpo legado retorna 401', async () => {
      const resposta = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {},
        headers: CABECALHO_CSRF,
      });

      expect(resposta.statusCode).toBe(401);
    });
  });

  describe('CSRF', () => {
    it('refresh sem o cabeçalho CSRF é rejeitado com 403 e não gasta o refresh', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const semCabecalho = await refreshComCookie(app, refresh, {});
      const depois = await refreshComCookie(app, refresh);

      expect(semCabecalho.statusCode).toBe(403);
      expect(semCabecalho.json()).toMatchObject({ code: 'CSRF_INVALID' });
      expect(depois.statusCode).toBe(200);
    });

    it('cabeçalho CSRF com valor errado é rejeitado', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const resposta = await refreshComCookie(app, refresh, { 'x-nossagrana-csrf': '0' });

      expect(resposta.statusCode).toBe(403);
    });

    it('origem cruzada é rejeitada mesmo com o cabeçalho CSRF', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const resposta = await refreshComCookie(app, refresh, {
        ...CABECALHO_CSRF,
        origin: 'https://evil.example',
      });

      expect(resposta.statusCode).toBe(403);
      expect(resposta.json()).toMatchObject({ code: 'CSRF_INVALID' });
    });

    it('aceita a origem configurada em CORS_ORIGIN e a mesma origem (Host)', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());
      const configurada = await refreshComCookie(app, refresh, {
        ...CABECALHO_CSRF,
        origin: env.CORS_ORIGIN,
      });
      const rotacionado = lerRefreshEmitido(configurada) ?? '';

      const mesmaOrigem = await refreshComCookie(app, rotacionado, {
        ...CABECALHO_CSRF,
        origin: 'https://app.example',
        host: 'app.example',
      });

      expect(configurada.statusCode).toBe(200);
      expect(mesmaOrigem.statusCode).toBe(200);
    });

    it('logout sem cabeçalho CSRF é rejeitado e a sessão continua válida', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const logout = await logoutComCookie(app, refresh, {});
      const depois = await refreshComCookie(app, refresh);

      expect(logout.statusCode).toBe(403);
      expect(depois.statusCode).toBe(200);
    });
  });

  describe('logout', () => {
    it('remove o cookie e invalida o refresh vigente', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const logout = await logoutComCookie(app, refresh);
      const depois = await refreshComCookie(app, refresh);

      expect(logout.statusCode).toBe(204);
      const [limpo] = lerSetCookie(logout);
      expect(limpo).toMatch(/^ng_refresh=;/);
      expect(limpo).toContain('Path=/api/auth');
      expect(limpo).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
      expect(depois.statusCode).toBe(401);
    });

    it('sem cookie retorna 401', async () => {
      const resposta = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: CABECALHO_CSRF,
      });

      expect(resposta.statusCode).toBe(401);
    });
  });

  describe('modo legado (REFRESH_TOKEN_BODY_FALLBACK)', () => {
    it('desligado: refresh no corpo, sem cookie, é recusado', async () => {
      const { refresh } = await registrarELogarComCookie(app, novoEmail());

      const resposta = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: refresh },
      });

      expect(resposta.statusCode).toBe(401);
    });

    it('ligado: cliente antigo (sem cabeçalho CSRF) recebe e envia refresh no corpo', async () => {
      env.REFRESH_TOKEN_BODY_FALLBACK = true;
      const email = novoEmail();
      await registrarELogarComCookie(app, email);

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, senha: 'senha12345' },
      });
      const { refreshToken } = login.json() as { refreshToken: string };
      const renovado = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      });

      expect(refreshToken).toEqual(expect.any(String));
      expect(renovado.statusCode).toBe(200);
      expect(renovado.json()).toMatchObject({ refreshToken: expect.any(String) });
    });

    it('ligado: cliente novo (com cabeçalho CSRF) continua sem refresh no JSON', async () => {
      env.REFRESH_TOKEN_BODY_FALLBACK = true;

      const { resposta } = await registrarELogarComCookie(app, novoEmail());

      expect(resposta.json()).toEqual({ accessToken: expect.any(String) });
    });

    it('ligado: replay do refresh legado continua detectado', async () => {
      env.REFRESH_TOKEN_BODY_FALLBACK = true;
      const email = novoEmail();
      await registrarELogarComCookie(app, email);
      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, senha: 'senha12345' },
      });
      const { refreshToken } = login.json() as { refreshToken: string };
      const enviar = () =>
        app.inject({ method: 'POST', url: '/api/auth/refresh', payload: { refreshToken } });
      await enviar();

      const replay = await enviar();

      expect(replay.json()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
    });
  });

  describe('CORS com credenciais', () => {
    it('preflight da origem configurada libera credenciais com a origem explícita', async () => {
      const resposta = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/refresh',
        headers: {
          origin: env.CORS_ORIGIN,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type,x-nossagrana-csrf',
        },
      });

      expect(resposta.headers['access-control-allow-origin']).toBe(env.CORS_ORIGIN);
      expect(resposta.headers['access-control-allow-credentials']).toBe('true');
    });

    it('preflight de origem estranha não recebe Allow-Origin (nem curinga)', async () => {
      const resposta = await app.inject({
        method: 'OPTIONS',
        url: '/api/auth/refresh',
        headers: {
          origin: 'https://evil.example',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'x-nossagrana-csrf',
        },
      });

      expect(resposta.headers['access-control-allow-origin']).not.toBe('*');
      expect(resposta.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    });
  });
});
