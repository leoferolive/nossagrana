import {
  orcamentoHistoricoResponseSchema,
  orcamentoListResponseSchema,
  orcamentoQuerySchema,
  orcamentoSetResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const errorSchemas = {
  401: z.object({ message: z.literal('Nao autenticado') }),
  400: z.object({ message: z.string() }),
};

export const orcamentoListSchema = {
  querystring: orcamentoQuerySchema,
  response: {
    200: orcamentoListResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const orcamentoSetSchema = {
  params: z.object({ categoriaId: z.string().uuid() }),
  body: z.object({
    valorLimite: z.string().regex(/^\d+(\.\d{1,2})?$/),
    vigenciaInicio: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  response: {
    200: orcamentoSetResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const orcamentoHistoricoSchema = {
  params: z.object({ categoriaId: z.string().uuid() }),
  response: {
    200: orcamentoHistoricoResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};
