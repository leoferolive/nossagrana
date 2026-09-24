import type { FastifyReply, FastifyRequest } from 'fastify';

import type { ConflitoDeConcorrenciaError } from './conflito-concorrencia.js';

/**
 * 409 para disputa de lock/deadlock (#59), com um warn estruturado para
 * observar a frequência de conflitos: só o SQLSTATE e a rota-template
 * (`POST /cofrinhos/:id/retiradas`) — sem IDs, valores ou corpo da requisição.
 *
 * @example if (erro instanceof ConflitoDeConcorrenciaError) return responderConflitoDeConcorrencia(erro, request, reply);
 */
export function responderConflitoDeConcorrencia(
  erro: ConflitoDeConcorrenciaError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  const operacao = `${request.method} ${request.routeOptions.url ?? 'rota-desconhecida'}`;
  request.log.warn(
    { sqlstate: erro.sqlstate, operacao },
    'Conflito de concorrência: operação desfeita, o cliente pode repetir',
  );
  return reply.code(409).send({ message: erro.message });
}
