import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@nossagrana/types';
import type { FastifyRequest } from 'fastify';

import { env } from '../../config/env.js';

/** Presença do cabeçalho CSRF com o valor esperado (também identifica o cliente novo no login). */
export const temCabecalhoCsrf = (request: FastifyRequest): boolean =>
  request.headers[CSRF_HEADER_NAME] === CSRF_HEADER_VALUE;

/** `Origin` ausente (cliente não-navegador) passa; presente, tem que ser a configurada ou o próprio host. */
function origemPermitida(request: FastifyRequest): boolean {
  const origem = request.headers.origin;
  if (!origem) return true;
  if (origem === env.CORS_ORIGIN) return true;
  try {
    return new URL(origem).host === request.host;
  } catch {
    return false;
  }
}

/**
 * Defesa CSRF dos endpoints que usam o cookie automaticamente (refresh, logout):
 * cabeçalho não-simples (exige preflight CORS) + checagem de `Origin`, além do `SameSite=Strict`.
 * Comparar o host em vez da origem inteira tolera TLS terminado no proxy (`http` interno).
 */
export const requisicaoCsrfValida = (request: FastifyRequest): boolean =>
  temCabecalhoCsrf(request) && origemPermitida(request);
