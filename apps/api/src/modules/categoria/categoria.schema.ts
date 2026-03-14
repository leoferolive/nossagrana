import {
  categoriaCreateRequestSchema,
  categoriaCreateResponseSchema,
  categoriaListResponseSchema,
  categoriaUpdateParamsSchema,
  categoriaUpdateRequestSchema,
  categoriaUpdateResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

export const categoriaListSchema = {
  response: {
    200: categoriaListResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
  },
};

export const categoriaCreateSchema = {
  body: categoriaCreateRequestSchema,
  response: {
    201: categoriaCreateResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
  },
};

export const categoriaUpdateSchema = {
  params: categoriaUpdateParamsSchema,
  body: categoriaUpdateRequestSchema,
  response: {
    200: categoriaUpdateResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    404: z.object({
      message: z.literal('Categoria nao encontrada'),
    }),
  },
};
