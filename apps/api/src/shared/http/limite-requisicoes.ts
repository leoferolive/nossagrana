import type { FastifyRequest } from 'fastify';

import { ErroComEnvelopeHttp } from './erro-com-envelope.js';

/**
 * Erro lançado quando um cliente estoura o limite de requisições. O
 * `@fastify/rate-limit` faz `throw` do que o `errorResponseBuilder` devolve; um
 * objeto solto sem `statusCode` virava 500 ao ser serializado contra o schema
 * da rota. Como `ErroComEnvelopeHttp`, o handler central responde 429 em
 * `{ error: { message, code } }`; o `retry-after` já foi gravado pelo plugin.
 */
export class LimiteRequisicoesError extends ErroComEnvelopeHttp {
  readonly statusHttp = 429;
  readonly code = 'LIMITE_REQUISICOES';

  constructor(segundos: number) {
    super(`Muitas tentativas. Tente novamente em ${segundos} segundos.`);
  }
}

/**
 * `errorResponseBuilder` do `@fastify/rate-limit` (v10: o retorno é lançado).
 * `ttl` vem em milissegundos.
 *
 * @example new LimiteRequisicoesError(30) // via construirErroDeLimite(req, { ttl: 30000 })
 */
export function construirErroDeLimite(
  _req: FastifyRequest,
  contexto: { ttl: number },
): LimiteRequisicoesError {
  return new LimiteRequisicoesError(Math.ceil(contexto.ttl / 1000));
}
