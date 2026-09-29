import { z } from 'zod';

export const familiaScope403Schema = z.union([
  z.object({
    error: z.object({
      message: z.literal('Usuario sem acesso a familia informada'),
      code: z.literal('FAMILIA_SEM_ACESSO'),
    }),
  }),
  z.object({
    error: z.object({
      message: z.literal('Familia excluida'),
      code: z.literal('FAMILIA_EXCLUIDA'),
    }),
  }),
]);
