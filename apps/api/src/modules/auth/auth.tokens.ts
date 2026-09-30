import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';

export interface ParDeTokens {
  accessToken: string;
  refreshToken: string;
}

/** Claims do refresh token depois de verificado (`iat`/`exp` em segundos, inseridos pelo JWT). */
export interface RefreshPayload {
  sub: string;
  email: string;
  tokenType?: string;
  exp?: number;
  iat?: number;
}

/** Emite access + refresh para o usuário; usado por login e por rotação no refresh. */
export function emitirParDeTokens(
  fastify: FastifyInstance,
  usuario: { sub: string; email: string },
): ParDeTokens {
  const accessToken = fastify.jwt.sign({ sub: usuario.sub, email: usuario.email });
  const refreshToken = fastify.jwt.sign(
    { sub: usuario.sub, email: usuario.email, tokenType: 'refresh' },
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN, key: env.REFRESH_TOKEN_SECRET },
  );
  return { accessToken, refreshToken };
}

/** Lança se o token for inválido/expirado ou não tiver sido assinado com o segredo de refresh. */
export function verificarRefreshToken(fastify: FastifyInstance, token: string): RefreshPayload {
  return fastify.jwt.verify<RefreshPayload>(token, { key: env.REFRESH_TOKEN_SECRET });
}
