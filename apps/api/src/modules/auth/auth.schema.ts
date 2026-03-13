import { authRegisterRequestSchema, authRegisterResponseSchema } from '@nossagrana/types';
import { z } from 'zod';

export const authRegisterSchema = {
  body: authRegisterRequestSchema,
  response: {
    201: authRegisterResponseSchema,
    409: z.object({
      message: z.literal('Email ja cadastrado'),
    }),
  },
};
