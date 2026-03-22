import {
  historicoDetalheResponseSchema,
  historicoListResponseSchema,
  snapshotManualResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const errorSchemas = {
  401: z.object({ message: z.literal('Nao autenticado') }),
  400: z.object({ message: z.string() }),
  404: z.object({ message: z.string() }),
};

export const historicoListSchema = {
  response: {
    200: historicoListResponseSchema,
    401: errorSchemas[401],
  },
};

export const historicoDetalheSchema = {
  params: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/) }),
  response: {
    200: historicoDetalheResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const snapshotManualSchema = {
  params: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/) }),
  response: {
    200: snapshotManualResponseSchema,
    401: errorSchemas[401],
  },
};
