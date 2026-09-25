import {
  transacaoAnteciparRequestSchema,
  transacaoCreateRequestSchema,
  transacaoCreateResponseSchema,
  transacaoListQuerySchema,
  transacaoListResponseSchema,
  transacaoParamsSchema,
  transacaoResponseSchema,
  transacaoUpdateRequestSchema,
} from '@nossagrana/types';
import { z } from 'zod';

import {
  chaveIdempotenciaInvalidaResponseSchema,
  idempotenciaConflitoResponseSchema,
  idempotencyKeyHeadersSchema,
} from '../../shared/idempotencia/idempotencia.http.js';
import { referenciaInvalidaResponseSchema } from '../../shared/referencia-ownership/referencia-ownership.http.js';

const errorSchemas = {
  400: z.object({ message: z.string() }),
  401: z.object({ message: z.literal('Nao autenticado') }),
  404: z.object({ message: z.literal('Transacao nao encontrada') }),
  422: referenciaInvalidaResponseSchema,
};

/** `Idempotency-Key` opcional (#90): sem o header, cada envio grava uma nova série. */
export const transacaoCreateSchema = {
  headers: idempotencyKeyHeadersSchema,
  body: transacaoCreateRequestSchema,
  response: {
    201: transacaoCreateResponseSchema,
    400: z.union([chaveIdempotenciaInvalidaResponseSchema, errorSchemas[400]]),
    401: errorSchemas[401],
    422: z.union([errorSchemas[422], idempotenciaConflitoResponseSchema]),
  },
};

export const transacaoListSchema = {
  querystring: transacaoListQuerySchema,
  response: {
    200: transacaoListResponseSchema,
    401: errorSchemas[401],
  },
};

export const transacaoGetSchema = {
  params: transacaoParamsSchema,
  response: {
    200: transacaoResponseSchema,
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const transacaoUpdateSchema = {
  params: transacaoParamsSchema,
  body: transacaoUpdateRequestSchema,
  response: {
    200: transacaoResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
    422: errorSchemas[422],
  },
};

export const transacaoDeleteSchema = {
  params: transacaoParamsSchema,
  response: {
    204: z.null(),
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const transacaoAnteciparSchema = {
  params: transacaoParamsSchema,
  body: transacaoAnteciparRequestSchema,
  response: {
    200: z.object({ antecipadas: z.number().int() }),
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export { transacaoAnteciparRequestSchema };
