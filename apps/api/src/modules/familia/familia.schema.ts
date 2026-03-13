import {
  familiaCreateInviteRequestSchema,
  familiaCreateInviteResponseSchema,
  familiaJoinByInviteParamsSchema,
  familiaJoinByInviteRequestSchema,
  familiaJoinByInviteResponseSchema,
  familiaListJoinRequestsResponseSchema,
  familiaListMembersParamsSchema,
  familiaListMembersResponseSchema,
  familiaRemoveMemberParamsSchema,
  familiaSwitchActiveRequestSchema,
  familiaSwitchActiveResponseSchema,
  familiaReviewJoinRequestParamsSchema,
  familiaReviewJoinRequestRequestSchema,
  familiaReviewJoinRequestResponseSchema,
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

export const familiaReviewJoinRequestSchema = {
  params: familiaReviewJoinRequestParamsSchema,
  body: familiaReviewJoinRequestRequestSchema,
  response: {
    200: familiaReviewJoinRequestResponseSchema,
    400: z.object({
      message: z.literal('familia_id invalido ou ausente'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    403: z.object({
      message: z.literal('Apenas admin pode listar solicitacoes'),
    }),
    404: z.object({
      message: z.literal('Solicitacao nao encontrada ou ja processada'),
    }),
  },
};

export const familiaListMembersSchema = {
  params: familiaListMembersParamsSchema,
  response: {
    200: familiaListMembersResponseSchema,
    400: z.object({
      message: z.literal('familia_id da rota difere da familia ativa'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
  },
};

export const familiaRemoveMemberSchema = {
  params: familiaRemoveMemberParamsSchema,
  response: {
    204: z.null(),
    400: z.object({
      message: z.literal('familia_id da rota difere da familia ativa'),
    }),
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    403: z.union([
      z.object({
        message: z.literal('Apenas admin pode remover membro'),
      }),
      z.object({
        message: z.literal('Admin nao pode remover a si mesmo'),
      }),
    ]),
    404: z.object({
      message: z.literal('Membro nao encontrado na familia'),
    }),
  },
};

export const familiaSwitchActiveSchema = {
  body: familiaSwitchActiveRequestSchema,
  response: {
    200: familiaSwitchActiveResponseSchema,
    401: z.object({
      message: z.literal('Nao autenticado'),
    }),
    403: z.object({
      message: z.literal('Usuario sem acesso a familia informada'),
    }),
  },
};
