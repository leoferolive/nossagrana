import { healthResponseSchema } from '@nossagrana/types';

export const healthSchema = {
  response: {
    200: healthResponseSchema,
  },
};
