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

const errorSchemas = {
  400: z.object({ message: z.string() }),
  401: z.object({ message: z.literal('Nao autenticado') }),
  404: z.object({ message: z.literal('Transacao nao encontrada') }),
};

export const transacaoCreateSchema = {
  body: transacaoCreateRequestSchema,
  response: {
    201: transacaoCreateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
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
