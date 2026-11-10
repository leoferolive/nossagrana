import type { FastifyRequest } from 'fastify';

import { env } from '../../config/env.js';

import { lerCookieRefresh } from './auth.cookie.js';
import { requisicaoCsrfValida } from './auth.csrf.js';

export type RefreshRecebido =
  | { ok: true; token: string; origem: 'cookie' | 'corpo' }
  | { ok: false; status: 401 | 403; corpo: { message: string; code?: string } };

const RECUSA_CSRF: RefreshRecebido = {
  ok: false,
  status: 403,
  corpo: { message: 'Requisicao recusada pela protecao CSRF', code: 'CSRF_INVALID' },
};
const RECUSA_AUSENTE: RefreshRecebido = {
  ok: false,
  status: 401,
  corpo: { message: 'Refresh token invalido' },
};

/**
 * Descobre de onde vem o refresh da requisição. O cookie exige CSRF; o corpo JSON (cliente
 * antigo, só com `REFRESH_TOKEN_BODY_FALLBACK`) não é enviado sozinho pelo navegador, então
 * não é vetor de CSRF.
 */
export function extrairRefresh(
  request: FastifyRequest,
  corpo: { refreshToken?: string } | null | undefined,
): RefreshRecebido {
  const doCookie = lerCookieRefresh(request);
  if (doCookie) {
    if (!requisicaoCsrfValida(request)) return RECUSA_CSRF;
    return { ok: true, token: doCookie, origem: 'cookie' };
  }
  if (env.REFRESH_TOKEN_BODY_FALLBACK && corpo?.refreshToken) {
    return { ok: true, token: corpo.refreshToken, origem: 'corpo' };
  }
  return RECUSA_AUSENTE;
}
