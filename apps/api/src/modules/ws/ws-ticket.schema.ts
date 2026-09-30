import { wsTicketResponseSchema } from '@nossagrana/types';
import { z } from 'zod';

/** `POST /ws/ticket` não tem body; a família vem do header `x-familia-id` (validado por `requireFamiliaScope`). */
export const wsTicketSchema = {
  response: {
    200: wsTicketResponseSchema,
    401: z.object({ message: z.string(), code: z.string().optional() }),
  },
};
