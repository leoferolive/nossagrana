import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { traduzirViolacaoReferencia } from './referencia-ownership.db-error.js';
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
 * qualquer rota — inclusive a violação de FK composta por família que o banco
 * detecta quando a validação do service é contornada (corrida/bypass, #58).
 * Os demais erros são relançados para o handler padrão do Fastify,
 * preservando o comportamento atual (400 de validação, 500 etc.).
 *
 * @example registrarRespostaReferenciaInvalida(app) // em buildApp, antes das rotas
 */
export function registrarRespostaReferenciaInvalida(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const traduzido = traduzirViolacaoReferencia(error);
    if (!(traduzido instanceof ReferenciaInvalidaError)) throw error;
    if (traduzido !== error) {
      request.log.warn(
        { entidade: traduzido.entidade },
        'FK composta por família rejeitou escrita',
      );
    }
    return reply.code(422).send({ error: { message: traduzido.message, code: traduzido.code } });
  });
}
