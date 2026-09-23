import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ReferenciaInvalidaError } from './referencia-ownership.validator.js';

/** Resposta 422 no envelope de erro de `.claude/rules/api-design.md`. */
export const referenciaInvalidaResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.literal('REFERENCIA_INVALIDA'),
  }),
});

/**
 * Serializa `ReferenciaInvalidaError` como `{ error: { message, code } }` em
 * qualquer rota. Os demais erros são relançados para o handler padrão do
 * Fastify, preservando o comportamento atual (400 de validação, 500 etc.).
 *
 * @example registrarRespostaReferenciaInvalida(app) // em buildApp, antes das rotas
 */
export function registrarRespostaReferenciaInvalida(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (!(error instanceof ReferenciaInvalidaError)) throw error;
    return reply.code(422).send({ error: { message: error.message, code: error.code } });
  });
}
