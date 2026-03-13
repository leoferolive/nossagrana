import {
  familiaCreateInviteRequestSchema,
  familiaCreateInviteResponseSchema,
  familiaJoinByInviteParamsSchema,
  familiaJoinByInviteRequestSchema,
  familiaJoinByInviteResponseSchema,
  familiaListJoinRequestsResponseSchema,
  familiaRequestJoinRequestSchema,
  familiaRequestJoinResponseSchema,
  familiaCreateRequestSchema,
  familiaCreateResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

export const familiaCreateSchema = {
  body: familiaCreateRequestSchema,
  response: {
    201: familiaCreateResponseSchema,
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
  },
};

export const familiaCreateInviteSchema = {
  body: familiaCreateInviteRequestSchema,
  response: {
    201: familiaCreateInviteResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    403: z.object({
      message: z.literal('Apenas admin pode gerar convite'),
    }),
  },
};

export const familiaJoinByInviteSchema = {
  params: familiaJoinByInviteParamsSchema,
  body: familiaJoinByInviteRequestSchema,
  response: {
    200: familiaJoinByInviteResponseSchema,
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    404: z.object({
      message: z.literal('Codigo de convite invalido ou expirado'),
    }),
  },
};

export const familiaRequestJoinSchema = {
  body: familiaRequestJoinRequestSchema,
  response: {
    201: familiaRequestJoinResponseSchema,
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
  },
};

export const familiaListJoinRequestsSchema = {
  response: {
    200: familiaListJoinRequestsResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    403: z.object({
      message: z.literal('Apenas admin pode listar solicitacoes'),
    }),
  },
};
