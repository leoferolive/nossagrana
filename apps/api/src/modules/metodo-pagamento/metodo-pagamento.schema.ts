import {
  metodoPagamentoCreateRequestSchema,
  metodoPagamentoCreateResponseSchema,
  metodoPagamentoDeleteResponseSchema,
  metodoPagamentoListResponseSchema,
  metodoPagamentoParamsSchema,
  metodoPagamentoUpdateRequestSchema,
  metodoPagamentoUpdateResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const errorSchemas = {
  400: z.object({ message: z.literal('familia_id invalido ou ausente') }),
  401: z.object({ message: z.literal('Nao autenticado') }),
  404: z.object({ message: z.literal('Metodo de pagamento nao encontrado') }),
};

export const metodoPagamentoListSchema = {
  response: {
    200: metodoPagamentoListResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const metodoPagamentoCreateSchema = {
  body: metodoPagamentoCreateRequestSchema,
  response: {
    201: metodoPagamentoCreateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const metodoPagamentoUpdateSchema = {
  params: metodoPagamentoParamsSchema,
  body: metodoPagamentoUpdateRequestSchema,
  response: {
    200: metodoPagamentoUpdateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const metodoPagamentoDeleteSchema = {
  params: metodoPagamentoParamsSchema,
  response: {
    200: metodoPagamentoDeleteResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};
