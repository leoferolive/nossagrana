import {
  alternarFamiliaRequestSchema,
  avaliarSolicitacaoRequestSchema,
  criarFamiliaRequestSchema,
  entrarViaConviteRequestSchema,
  familiaResponseSchema,
  gerarConviteResponseSchema,
  membroResponseSchema,
  solicitacaoResponseSchema,
  solicitarEntradaRequestSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const unauthorized = z.object({ message: z.string() });
const forbidden = z.object({ message: z.string() });
const conflict = z.object({ message: z.string() });
const notFound = z.object({ message: z.string() });

export const criarFamiliaSchema = {
  body: criarFamiliaRequestSchema,
  response: { 201: familiaResponseSchema, 401: unauthorized },
};

export const listarFamiliasSchema = {
  response: { 200: z.array(familiaResponseSchema), 401: unauthorized },
};

export const gerarConviteSchema = {
  params: z.object({ id: z.string().uuid() }),
  response: { 201: gerarConviteResponseSchema, 401: unauthorized, 403: forbidden },
};

export const entrarViaConviteSchema = {
  body: entrarViaConviteRequestSchema,
  response: { 200: z.object({ familiaId: z.string().uuid(), role: z.string() }), 400: notFound, 401: unauthorized, 409: conflict },
};

export const solicitarEntradaSchema = {
  body: solicitarEntradaRequestSchema,
  response: { 201: solicitacaoResponseSchema, 401: unauthorized, 409: conflict },
};

export const listarSolicitacoesSchema = {
  params: z.object({ id: z.string().uuid() }),
  response: { 200: z.array(solicitacaoResponseSchema), 401: unauthorized, 403: forbidden },
};

export const avaliarSolicitacaoSchema = {
  params: z.object({ id: z.string().uuid(), solicitacaoId: z.string().uuid() }),
  body: avaliarSolicitacaoRequestSchema,
  response: { 200: solicitacaoResponseSchema, 401: unauthorized, 403: forbidden, 404: notFound },
};

export const listarMembrosSchema = {
  params: z.object({ id: z.string().uuid() }),
  response: { 200: z.array(membroResponseSchema), 401: unauthorized, 403: forbidden },
};

export const removerMembroSchema = {
  params: z.object({ id: z.string().uuid(), usuarioId: z.string().uuid() }),
  response: { 204: z.undefined(), 401: unauthorized, 403: forbidden },
};

export const excluirFamiliaSchema = {
  params: z.object({ id: z.string().uuid() }),
  response: { 204: z.undefined(), 401: unauthorized, 403: forbidden },
};

export const alternarFamiliaSchema = {
  body: alternarFamiliaRequestSchema,
  response: { 200: z.object({ familiaId: z.string().uuid() }), 401: unauthorized, 403: forbidden },
};
