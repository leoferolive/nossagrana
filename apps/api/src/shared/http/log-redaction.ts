import type { FastifyRequest } from 'fastify';

const MARCA_REDIGIDA = '[REDACTED]';

/**
 * Parâmetros de query que carregam credencial. `ticket` é o do WebSocket (#118); `token` é o
 * formato legado (JWT na URL) que o servidor já não aceita, mas um cliente antigo ainda pode
 * enviar, e o valor não pode parar no log.
 */
const PARAMETROS_SENSIVEIS = /([?&](?:ticket|token|accessToken|refreshToken)=)[^&#]*/gi;

/** Troca o valor dos parâmetros sensíveis da query por `[REDACTED]`; o resto da URL fica igual. */
export function redigirUrl(url: string): string {
  return url.replace(PARAMETROS_SENSIVEIS, `$1${MARCA_REDIGIDA}`);
}

/**
 * Mesmo formato do serializer `req` padrão do Fastify, mas com a URL redigida: o log de
 * "incoming request" é o que gravaria `/api/ws?ticket=...` em texto claro.
 */
function serializarRequisicao(request: FastifyRequest) {
  return {
    method: request.method,
    url: redigirUrl(request.url),
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  };
}

/** Logger JSON estruturado do Fastify com redação de credenciais na URL (#118). */
export function opcoesDoLogger() {
  return { serializers: { req: serializarRequisicao } };
}
