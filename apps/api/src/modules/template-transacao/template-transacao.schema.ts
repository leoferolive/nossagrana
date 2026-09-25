import {
  templateTransacaoAplicarRequestSchema,
  templateTransacaoAplicarResponseSchema,
  templateTransacaoCreateRequestSchema,
  templateTransacaoCreateResponseSchema,
  templateTransacaoListResponseSchema,
  templateTransacaoReordenarRequestSchema,
  templateTransacaoUpdateRequestSchema,
} from '@nossagrana/types';
import { z } from 'zod';

import {
  chaveIdempotenciaInvalidaResponseSchema,
  idempotenciaConflitoResponseSchema,
  idempotencyKeyHeadersSchema,
} from '../../shared/idempotencia/idempotencia.http.js';
import { referenciaInvalidaResponseSchema } from '../../shared/referencia-ownership/referencia-ownership.http.js';

const errorSchemas = {
  404: z.object({ message: z.string() }),
  409: z.object({ message: z.string() }),
};

export const templateTransacaoListSchema = {
  response: { 200: templateTransacaoListResponseSchema },
};

export const templateTransacaoCreateSchema = {
  body: templateTransacaoCreateRequestSchema,
  response: {
    201: templateTransacaoCreateResponseSchema,
    409: errorSchemas[409],
    422: referenciaInvalidaResponseSchema,
  },
};

export const templateTransacaoUpdateSchema = {
  body: templateTransacaoUpdateRequestSchema,
  response: {
    200: templateTransacaoCreateResponseSchema,
    404: errorSchemas[404],
    409: errorSchemas[409],
    422: referenciaInvalidaResponseSchema,
  },
};

export const templateTransacaoDeleteSchema = {
  response: {
    200: templateTransacaoCreateResponseSchema,
    404: errorSchemas[404],
  },
};

/** `Idempotency-Key` opcional (#90): sem ela, cada envio grava o lote de novo. */
export const templateTransacaoAplicarSchema = {
  headers: idempotencyKeyHeadersSchema,
  body: templateTransacaoAplicarRequestSchema,
  response: {
    200: templateTransacaoAplicarResponseSchema,
    400: z.union([chaveIdempotenciaInvalidaResponseSchema, errorSchemas[404]]),
    404: errorSchemas[404],
    409: errorSchemas[409],
    422: z.union([referenciaInvalidaResponseSchema, idempotenciaConflitoResponseSchema]),
  },
};

export const templateTransacaoReordenarSchema = {
  body: templateTransacaoReordenarRequestSchema,
};
