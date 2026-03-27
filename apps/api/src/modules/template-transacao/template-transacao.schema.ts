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
  },
};

export const templateTransacaoUpdateSchema = {
  body: templateTransacaoUpdateRequestSchema,
  response: {
    200: templateTransacaoCreateResponseSchema,
    404: errorSchemas[404],
  },
};

export const templateTransacaoDeleteSchema = {
  response: {
    200: templateTransacaoCreateResponseSchema,
    404: errorSchemas[404],
  },
};

export const templateTransacaoAplicarSchema = {
  body: templateTransacaoAplicarRequestSchema,
  response: {
    200: templateTransacaoAplicarResponseSchema,
    404: errorSchemas[404],
  },
};

export const templateTransacaoReordenarSchema = {
  body: templateTransacaoReordenarRequestSchema,
};
