import {
  cofrinhoAporteRequestSchema,
  cofrinhoAporteResponseSchema,
  cofrinhoCreateRequestSchema,
  cofrinhoCreateResponseSchema,
  cofrinhoDetalheResponseSchema,
  cofrinhoEncerrarRequestSchema,
  cofrinhoEncerrarResponseSchema,
  cofrinhoListQuerySchema,
  cofrinhoListResponseSchema,
  cofrinhoParamsSchema,
  cofrinhoRetiradaRequestSchema,
  cofrinhoRetiradaResponseSchema,
  cofrinhoUpdateRequestSchema,
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
  404: z.object({ message: z.string() }),
  409: z.object({ message: z.string() }),
};

/** Aporte/retirada aceitam `Idempotency-Key` opcional (#90): sem ela, cada envio movimenta o saldo. */
const respostasIdempotencia = {
  400: z.union([chaveIdempotenciaInvalidaResponseSchema, errorSchemas[400]]),
  // Referência inválida (FK composta, #58) também chega aqui: sem ela no schema viraria 500.
  422: z.union([referenciaInvalidaResponseSchema, idempotenciaConflitoResponseSchema]),
};

export const cofrinhoCreateSchema = {
  body: cofrinhoCreateRequestSchema,
  response: {
    201: cofrinhoCreateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const cofrinhoListSchema = {
  querystring: cofrinhoListQuerySchema,
  response: {
    200: cofrinhoListResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const cofrinhoDetalheSchema = {
  params: cofrinhoParamsSchema,
  response: {
    200: cofrinhoDetalheResponseSchema,
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const cofrinhoUpdateSchema = {
  params: cofrinhoParamsSchema,
  body: cofrinhoUpdateRequestSchema,
  response: {
    200: cofrinhoCreateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const cofrinhoAporteSchema = {
  headers: idempotencyKeyHeadersSchema,
  params: cofrinhoParamsSchema,
  body: cofrinhoAporteRequestSchema,
  response: {
    201: cofrinhoAporteResponseSchema,
    400: respostasIdempotencia[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
    409: errorSchemas[409],
    422: respostasIdempotencia[422],
  },
};

export const cofrinhoRetiradaSchema = {
  headers: idempotencyKeyHeadersSchema,
  params: cofrinhoParamsSchema,
  body: cofrinhoRetiradaRequestSchema,
  response: {
    201: cofrinhoRetiradaResponseSchema,
    400: respostasIdempotencia[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
    409: errorSchemas[409],
    422: respostasIdempotencia[422],
  },
};

export const cofrinhoEncerrarSchema = {
  params: cofrinhoParamsSchema,
  body: cofrinhoEncerrarRequestSchema,
  response: {
    200: cofrinhoEncerrarResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
    409: errorSchemas[409],
  },
};

export const cofrinhoAporteRecorrenteDeleteSchema = {
  params: cofrinhoParamsSchema,
  response: {
    204: z.null(),
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};
