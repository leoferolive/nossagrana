import { wsTicketEnvelopeSchema } from '@nossagrana/types';
import { z } from 'zod';

/** `POST /ws/ticket` não tem body; a família vem do header `x-familia-id` (validado por `requireFamiliaScope`). */
export const wsTicketSchema = {
  response: {
    200: wsTicketEnvelopeSchema,
    // 401 do `authenticate` ({ message }) ou da sessão revogada, no envelope de api-design.md.
    401: z.union([
      z.object({ error: z.object({ message: z.string(), code: z.string().optional() }) }),
      z.object({ message: z.string() }),
    ]),
  },
};
