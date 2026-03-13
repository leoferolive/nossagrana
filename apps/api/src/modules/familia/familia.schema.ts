import {
  familiaCreateInviteRequestSchema,
  familiaCreateInviteResponseSchema,
  familiaCreateRequestSchema,
  familiaCreateResponseSchema,
} from '@nossagrana/types';
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

export const familiaCreateInviteSchema = {
  body: familiaCreateInviteRequestSchema,
  response: {
    201: familiaCreateInviteResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    403: z.object({
      message: z.literal('Apenas admin pode gerar convite'),
    }),
  },
};
