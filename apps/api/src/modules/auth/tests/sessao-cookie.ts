import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@nossagrana/types';
import type { LightMyRequestResponse } from 'fastify';

import type { buildApp } from '../../../app.js';

type App = ReturnType<typeof buildApp>;

const NOME_COOKIE_DEV = 'ng_refresh';
export const NOME_COOKIE_PROD = '__Secure-ng_refresh';
export const CABECALHO_CSRF = { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE };

/** Set-Cookie bruto (todas as linhas) da resposta, como lista. */
export function lerSetCookie(resposta: LightMyRequestResponse): string[] {
  const bruto = resposta.headers['set-cookie'];
  if (!bruto) return [];
  return Array.isArray(bruto) ? bruto : [bruto];
}

/** Valor do cookie de refresh emitido na resposta (`null` se não houver ou se foi limpo). */
export function lerRefreshEmitido(resposta: LightMyRequestResponse): string | null {
  const linha = lerSetCookie(resposta).find((c) => /^(__Secure-)?ng_refresh=/.test(c));
  const valor = linha?.split(';')[0]?.split('=')[1];
  return valor ? valor : null;
}

export const logarComCookie = (app: App, email: string, senha: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, senha },
    headers: CABECALHO_CSRF,
  });

export const refreshComCookie = (
  app: App,
  refresh: string,
  headers: Record<string, string> = CABECALHO_CSRF,
) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    payload: {},
    headers,
    cookies: { [NOME_COOKIE_DEV]: refresh },
  });

export const logoutComCookie = (
  app: App,
  refresh: string,
  headers: Record<string, string> = CABECALHO_CSRF,
) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers,
    cookies: { [NOME_COOKIE_DEV]: refresh },
  });

export async function registrarELogarComCookie(app: App, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { nome: 'Usuario Cookie', email, senha: 'senha12345' },
  });
  const resposta = await logarComCookie(app, email, 'senha12345');
  return { resposta, refresh: lerRefreshEmitido(resposta) ?? '' };
}
