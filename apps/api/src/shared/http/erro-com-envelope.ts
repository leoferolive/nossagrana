import type { FastifyReply } from 'fastify';

/**
 * Erro de domínio que já sabe seu status HTTP e seu `code`: o handler central
 * (`registrarRespostaReferenciaInvalida`) o serializa no envelope de
 * `.claude/rules/api-design.md` em qualquer rota, sem try/catch por rota.
 *
 * @example class ChaveInvalidaError extends ErroComEnvelopeHttp { readonly statusHttp = 400; readonly code = 'X'; }
 */
export abstract class ErroComEnvelopeHttp extends Error {
  abstract readonly statusHttp: number;
  abstract readonly code: string;
}

/** Responde `{ error: { message, code } }` se `erro` for um `ErroComEnvelopeHttp`; senão `undefined`. */
export function responderErroComEnvelope(
  erro: unknown,
  reply: FastifyReply,
): FastifyReply | undefined {
  if (!(erro instanceof ErroComEnvelopeHttp)) return undefined;
  return reply.code(erro.statusHttp).send({ error: { message: erro.message, code: erro.code } });
}
