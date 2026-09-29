import { z } from 'zod';

export const familiaScope403Schema = z.union([
  z.object({ message: z.literal('Usuario sem acesso a familia informada') }),
  z.object({
    error: z.object({
      message: z.literal('Familia excluida'),
      code: z.literal('FAMILIA_EXCLUIDA'),
    }),
  }),
]);
