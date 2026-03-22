import {
  cofrinhoAporteRequestSchema,
  cofrinhoAporteResponseSchema,
  cofrinhoCreateRequestSchema,
  cofrinhoCreateResponseSchema,
  cofrinhoDetalheResponseSchema,
  cofrinhoEncerrarRequestSchema,
  cofrinhoEncerrarResponseSchema,
  cofrinhoListQuerySchema,
  cofrinhoListResponseSchema,
  cofrinhoParamsSchema,
  cofrinhoRetiradaRequestSchema,
  cofrinhoRetiradaResponseSchema,
  cofrinhoUpdateRequestSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const errorSchemas = {
  400: z.object({ message: z.string() }),
  401: z.object({ message: z.literal('Nao autenticado') }),
  404: z.object({ message: z.string() }),
  409: z.object({ message: z.string() }),
};

export const cofrinhoCreateSchema = {
  body: cofrinhoCreateRequestSchema,
  response: {
    201: cofrinhoCreateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const cofrinhoListSchema = {
  querystring: cofrinhoListQuerySchema,
  response: {
    200: cofrinhoListResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const cofrinhoDetalheSchema = {
  params: cofrinhoParamsSchema,
  response: {
    200: cofrinhoDetalheResponseSchema,
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const cofrinhoUpdateSchema = {
  params: cofrinhoParamsSchema,
  body: cofrinhoUpdateRequestSchema,
  response: {
    200: cofrinhoCreateResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const cofrinhoAporteSchema = {
  params: cofrinhoParamsSchema,
  body: cofrinhoAporteRequestSchema,
  response: {
    201: cofrinhoAporteResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
    409: errorSchemas[409],
  },
};

export const cofrinhoRetiradaSchema = {
  params: cofrinhoParamsSchema,
  body: cofrinhoRetiradaRequestSchema,
  response: {
    201: cofrinhoRetiradaResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const cofrinhoEncerrarSchema = {
  params: cofrinhoParamsSchema,
  body: cofrinhoEncerrarRequestSchema,
  response: {
    200: cofrinhoEncerrarResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};

export const cofrinhoAporteRecorrenteDeleteSchema = {
  params: cofrinhoParamsSchema,
  response: {
    204: z.null(),
    401: errorSchemas[401],
    404: errorSchemas[404],
  },
};
