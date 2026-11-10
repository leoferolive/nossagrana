import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../../config/env.js';

/**
 * Cookie do refresh token (#116).
 *
 * - `HttpOnly`: JavaScript (logo, XSS) não lê o refresh.
 * - `SameSite=Strict`: web e API são do mesmo site (nossagrana.* serve `/api` no mesmo host;
 *   em dev, localhost:5173 e localhost:3000 também são same-site), então Strict não custa nada.
 * - `Path=/api/auth`: o cookie só viaja para login/refresh/logout, não para as demais rotas.
 * - Sem `Domain`: cookie "host-only", nunca compartilhado com subdomínios.
 * - `Secure` + prefixo `__Secure-` conforme `REFRESH_COOKIE_SECURE` (true em prod, false no dev HTTP). `__Host-` exigiria `Path=/` (mandaria o
 *   cookie a toda requisição), então ficamos com `__Secure-` e o Path mínimo.
 */
const CAMINHO_COOKIE = '/api/auth';
const NOME_BASE = 'ng_refresh';

/** Nome do cookie (`__Secure-ng_refresh` quando `REFRESH_COOKIE_SECURE`). */
export const nomeDoCookieRefresh = (): string =>
  env.REFRESH_COOKIE_SECURE ? `__Secure-${NOME_BASE}` : NOME_BASE;

const opcoesBase = () => ({
  httpOnly: true,
  secure: env.REFRESH_COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: CAMINHO_COOKIE,
});

/** Grava o refresh no cookie; a validade acompanha o `exp` do próprio token. */
export function gravarCookieRefresh(reply: FastifyReply, refreshToken: string): void {
  const exp = reply.server.jwt.decode<{ exp?: number }>(refreshToken)?.exp;
  const maxAge = exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : undefined;
  reply.setCookie(nomeDoCookieRefresh(), refreshToken, { ...opcoesBase(), maxAge });
}

/** Remove o cookie (mesmos atributos de escopo, senão o navegador não o apaga). */
export function limparCookieRefresh(reply: FastifyReply): void {
  reply.clearCookie(nomeDoCookieRefresh(), opcoesBase());
}

export const lerCookieRefresh = (request: FastifyRequest): string | undefined =>
  request.cookies[nomeDoCookieRefresh()] || undefined;
