import { categoriaListResponseSchema } from '@nossagrana/types';
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
