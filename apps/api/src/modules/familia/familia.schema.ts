import { familiaCreateRequestSchema, familiaCreateResponseSchema } from '@nossagrana/types';
import { z } from 'zod';

export const familiaCreateSchema = {
  body: familiaCreateRequestSchema,
  response: {
    201: familiaCreateResponseSchema,
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
  },
};
