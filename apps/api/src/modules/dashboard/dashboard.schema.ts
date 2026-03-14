import {
  dashboardGraficosResponseSchema,
  dashboardOrcamentoResponseSchema,
  dashboardQuerySchema,
  dashboardResumoResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const errorSchemas = {
  401: z.object({ message: z.literal('Nao autenticado') }),
  400: z.object({ message: z.string() }),
};

export const dashboardResumoSchema = {
  querystring: dashboardQuerySchema,
  response: {
    200: dashboardResumoResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const dashboardGraficosSchema = {
  querystring: dashboardQuerySchema,
  response: {
    200: dashboardGraficosResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const dashboardOrcamentoSchema = {
  querystring: dashboardQuerySchema,
  response: {
    200: dashboardOrcamentoResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};
