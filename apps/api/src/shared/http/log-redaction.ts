import type { FastifyRequest } from 'fastify';

const MARCA_REDIGIDA = '[REDACTED]';

/**
 * Parâmetros de query que carregam credencial (comparados em minúsculas). `ticket` é o do
 * WebSocket (#118); `token` é o formato legado (JWT na URL) que o servidor já não aceita, mas um
 * cliente antigo ainda pode enviar, e o valor não pode parar no log.
 */
const PARAMETROS_SENSIVEIS = new Set(['ticket', 'token', 'accesstoken', 'refreshtoken']);

/** A chave como o Fastify a lê: `+` vira espaço e `%XX` é decodificado (`%74icket` = `ticket`). */
function decodificarChave(chaveBruta: string): string {
  try {
    return decodeURIComponent(chaveBruta.replace(/\+/g, ' '));
  } catch {
    return chaveBruta;
  }
}

function redigirPar(par: string): string {
  const igual = par.indexOf('=');
  if (igual === -1) return par;
  const chave = decodificarChave(par.slice(0, igual)).toLowerCase();
  return PARAMETROS_SENSIVEIS.has(chave) ? `${par.slice(0, igual + 1)}${MARCA_REDIGIDA}` : par;
}

/**
 * Troca o valor dos parâmetros sensíveis da query por `[REDACTED]`; o resto da URL fica igual.
 * Decodifica a chave antes de comparar: o Fastify lê `?%74icket=...` como `ticket`, então um
 * regex sobre o texto cru deixaria passar uma credencial válida.
 */
export function redigirUrl(url: string): string {
  const inicioDaQuery = url.indexOf('?');
  if (inicioDaQuery === -1) return url;
  const fimDaQuery = url.indexOf('#', inicioDaQuery);
  const fim = fimDaQuery === -1 ? url.length : fimDaQuery;
  const pares = url
    .slice(inicioDaQuery + 1, fim)
    .split('&')
    .map(redigirPar);
  return `${url.slice(0, inicioDaQuery + 1)}${pares.join('&')}${url.slice(fim)}`;
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
