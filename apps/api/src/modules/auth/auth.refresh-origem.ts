import type { FastifyRequest } from 'fastify';

import { lerCookieRefresh } from './auth.cookie.js';
import { requisicaoCsrfValida } from './auth.csrf.js';

export type RefreshRecebido =
  | { ok: true; token: string }
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
 * Lê o refresh da requisição: só pelo cookie (exige CSRF). O corpo JSON nunca é aceito, então
 * o refresh não circula em respostas nem em payloads.
 */
export function extrairRefresh(request: FastifyRequest): RefreshRecebido {
  const doCookie = lerCookieRefresh(request);
  if (!doCookie) return RECUSA_AUSENTE;
  if (!requisicaoCsrfValida(request)) return RECUSA_CSRF;
  return { ok: true, token: doCookie };
}
