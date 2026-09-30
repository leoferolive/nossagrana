import type { FastifyInstance } from 'fastify';

import { emitirParDeTokens, type ParDeTokens, verificarRefreshToken } from './auth.tokens.js';
import { hashToken } from './revoked-token.repository.js';

export type ResultadoRefresh =
  | ({ ok: true } & ParDeTokens)
  | { ok: false; corpo: { message: string; code?: string } };

const RECUSA_REUSO: ResultadoRefresh = {
  ok: false,
  corpo: { message: 'Token reuse detected', code: 'TOKEN_REUSE_DETECTED' },
};
const RECUSA_SESSAO_REVOGADA: ResultadoRefresh = {
  ok: false,
  corpo: { message: 'Sessao revogada', code: 'SESSION_REVOKED' },
};
const RECUSA_TOKEN_INVALIDO: ResultadoRefresh = {
  ok: false,
  corpo: { message: 'Refresh token invalido' },
};

/** Reuso de refresh já rotacionado = possível roubo: revoga todas as sessões do dono. */
async function tratarReuso(fastify: FastifyInstance, refreshToken: string) {
  const userId = extrairUserId(fastify, refreshToken);
  if (userId) await revogarPorReuso(fastify, userId);
  return RECUSA_REUSO;
}

function extrairUserId(fastify: FastifyInstance, refreshToken: string): string | null {
  try {
    return verificarRefreshToken(fastify, refreshToken).sub;
  } catch {
    // Token expirado/inválido — não conseguimos decodificar userId
    return null;
  }
}

/** Falha aqui deixa sessões vivas após um possível roubo de token: não pode sumir em silêncio. */
async function revogarPorReuso(fastify: FastifyInstance, userId: string): Promise<void> {
  try {
    await fastify.sessoes.revogarTodas(userId);
  } catch (error) {
    fastify.log.error({ userId, err: error }, 'Reuso de refresh detectado mas revogação falhou');
  }
}

/**
 * Rotaciona o refresh token. Lança se o token não for verificável (o chamador responde 401).
 *
 * Ordem importa (#119, corrida refresh x revogação): checar → gastar o refresh → emitir o
 * novo par → checar DE NOVO o refresh antigo. Uma revogação global gravada entre a 1ª
 * checagem e a emissão é vista pela 2ª; uma gravada depois dela tem `revokedAt` >= instante
 * da emissão, então o `iat` do par novo já cai na regra "emitido até o segundo da revogação".
 */
export async function renovarSessao(
  fastify: FastifyInstance,
  refreshToken: string,
): Promise<ResultadoRefresh> {
  const tokenHash = hashToken(refreshToken);
  if (await fastify.tokensRevogados.isRevoked(tokenHash)) {
    return tratarReuso(fastify, refreshToken);
  }

  const refresh = verificarRefreshToken(fastify, refreshToken);
  if (refresh.tokenType !== 'refresh') return RECUSA_TOKEN_INVALIDO;
  if (await fastify.sessoes.estaRevogada(refresh.sub, refresh.iat)) return RECUSA_SESSAO_REVOGADA;

  const expiraEm = new Date((refresh.exp ?? Math.floor(Date.now() / 1000)) * 1000);
  await fastify.tokensRevogados.revokeToken(tokenHash, expiraEm, refresh.sub);

  const novoPar = emitirParDeTokens(fastify, refresh);
  if (await fastify.sessoes.estaRevogada(refresh.sub, refresh.iat)) return RECUSA_SESSAO_REVOGADA;
  return { ok: true, ...novoPar };
}
