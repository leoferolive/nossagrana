import { createHash } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  ChaveIdempotenciaInvalidaError,
  FORMATO_CHAVE_IDEMPOTENCIA,
} from './idempotencia.errors.js';
import type {
  PedidoIdempotente,
  RespostaGravada,
  ResultadoIdempotente,
} from './idempotencia.types.js';

const HEADER_CHAVE = 'idempotency-key';
const HEADER_REPLAY = 'Idempotent-Replayed';

/**
 * Header documentado no schema das rotas. O formato NÃO é validado aqui (o
 * erro sairia no formato padrão do Fastify): `lerChaveIdempotencia` valida e
 * responde 400 no envelope. `passthrough` porque o validador substitui
 * `request.headers` pelo valor parseado — sem ele, sumiriam os demais headers.
 */
export const idempotencyKeyHeadersSchema = z
  .object({
    [HEADER_CHAVE]: z
      .string()
      .optional()
      .describe(
        'Opcional. 8–128 caracteres [A-Za-z0-9_-] (ex.: UUID), um por tentativa de envio do ' +
          'usuário. Mesma chave + mesmo payload em 24h → resposta gravada, sem executar de novo ' +
          '(header Idempotent-Replayed: true). Payload/operação diferente → 422 ' +
          'IDEMPOTENCIA_CONFLITO. Sem o header não há deduplicação: cada envio executa.',
      ),
  })
  .passthrough();

const envelopeDeErro = <C extends string>(code: C) =>
  z.object({ error: z.object({ message: z.string(), code: z.literal(code) }) });

export const chaveIdempotenciaInvalidaResponseSchema = envelopeDeErro(
  'IDEMPOTENCIA_CHAVE_INVALIDA',
);
export const idempotenciaConflitoResponseSchema = envelopeDeErro('IDEMPOTENCIA_CONFLITO');

type Headers = Record<string, string | string[] | undefined>;

/** `null` sem header; lança `ChaveIdempotenciaInvalidaError` (400) fora do formato. */
export function lerChaveIdempotencia(headers: Headers): string | null {
  const valor = headers[HEADER_CHAVE];
  if (valor === undefined) return null;
  if (typeof valor !== 'string') throw new ChaveIdempotenciaInvalidaError(valor.join(',').length);
  if (!FORMATO_CHAVE_IDEMPOTENCIA.test(valor))
    throw new ChaveIdempotenciaInvalidaError(valor.length);
  return valor;
}

/** JSON com chaves de objeto ordenadas: o mesmo payload gera sempre o mesmo texto. */
export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(ordenarChaves(valor));
}

function ordenarChaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarChaves);
  if (valor === null || typeof valor !== 'object') return valor;
  const entradas = Object.entries(valor).sort(([a], [b]) => (a < b ? -1 : Number(a > b)));
  return Object.fromEntries(entradas.map(([chave, v]) => [chave, ordenarChaves(v)]));
}

/** sha256 hex do JSON canônico: só o hash é gravado, nunca o payload em claro. */
export function hashDoPayload(material: unknown): string {
  return createHash('sha256').update(jsonCanonico(material)).digest('hex');
}

interface RequisicaoIdempotente {
  headers: Headers;
  operacao: string;
  familiaId: string;
  usuarioId: string;
  params: unknown;
  corpo: unknown;
}

/**
 * Pedido da requisição, ou `null` sem header. O hash cobre usuário, params
 * (ex.: o cofrinho da URL) e corpo já validado: mesma chave com outro
 * cofrinho, outro valor ou outro usuário da família é conflito, não replay.
 */
export function pedidoIdempotenteDe(req: RequisicaoIdempotente): PedidoIdempotente | null {
  const chave = lerChaveIdempotencia(req.headers);
  if (!chave) return null;
  const hashPayload = hashDoPayload({
    usuarioId: req.usuarioId,
    params: req.params,
    corpo: req.corpo,
  });
  return { familiaId: req.familiaId, chave, operacao: req.operacao, hashPayload };
}

/** Adapter Fastify: operação = rota-template (`POST /api/cofrinhos/:id/aportes`). */
export function pedidoIdempotenteDaRequisicao(request: FastifyRequest): PedidoIdempotente | null {
  return pedidoIdempotenteDe({
    headers: request.headers,
    operacao: `${request.method} ${request.routeOptions.url ?? request.url}`,
    familiaId: request.familiaIdAtiva as string,
    usuarioId: request.user.sub,
    params: request.params,
    corpo: request.body,
  });
}

/**
 * Envia o resultado: execução nova usa `responder` (o mesmo usado para gravar
 * a resposta); replay devolve status e corpo gravados + `Idempotent-Replayed`.
 */
export function responderIdempotente<T>(
  reply: FastifyReply,
  resultado: ResultadoIdempotente<T>,
  responder: (valor: T) => RespostaGravada,
): FastifyReply {
  if (resultado.tipo === 'executada') {
    const { statusCode, corpo } = responder(resultado.valor);
    return reply.code(statusCode).send(corpo);
  }
  reply.request.log.info({ operacao: reply.request.routeOptions.url }, 'Replay idempotente');
  const { statusCode, corpo } = resultado.resposta;
  return reply.code(statusCode).header(HEADER_REPLAY, 'true').send(corpo);
}
