import { z } from 'zod';

export const familyRoleSchema = z.enum(['admin', 'membro']);
export type FamilyRole = z.infer<typeof familyRoleSchema>;

export const transactionTypeSchema = z.enum(['receita', 'despesa']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const categoriaTipoSchema = z.enum(['receita', 'despesa']);
export type CategoriaTipo = z.infer<typeof categoriaTipoSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  app: z.literal('api'),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const authRegisterRequestSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email(),
  senha: z.string().min(8),
});

export type AuthRegisterRequest = z.infer<typeof authRegisterRequestSchema>;

export const authRegisterResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    nome: z.string(),
    email: z.string().email(),
    dataCriacao: z.string(),
  }),
});

export type AuthRegisterResponse = z.infer<typeof authRegisterResponseSchema>;

export const authLoginRequestSchema = z.object({
  email: z.string().trim().email(),
  senha: z.string().min(8),
});

export type AuthLoginRequest = z.infer<typeof authLoginRequestSchema>;

export const authLoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;

export const authRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type AuthRefreshRequest = z.infer<typeof authRefreshRequestSchema>;

export const authRefreshResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type AuthRefreshResponse = z.infer<typeof authRefreshResponseSchema>;

export const authLogoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export type AuthLogoutRequest = z.infer<typeof authLogoutRequestSchema>;

export const authMeResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
  }),
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const familiaCreateRequestSchema = z.object({
  nome: z.string().trim().min(1),
});

export type FamiliaCreateRequest = z.infer<typeof familiaCreateRequestSchema>;

export const familiaCreateResponseSchema = z.object({
  familia: z.object({
    id: z.string().uuid(),
    nome: z.string().min(1),
    dataCriacao: z.string(),
  }),
});

export type FamiliaCreateResponse = z.infer<typeof familiaCreateResponseSchema>;

export const familiaCreateInviteRequestSchema = z.object({});

export type FamiliaCreateInviteRequest = z.infer<typeof familiaCreateInviteRequestSchema>;

export const familiaCreateInviteResponseSchema = z.object({
  convite: z.object({
    id: z.string().uuid(),
    familiaId: z.string().uuid(),
    codigo: z.string().min(1),
    expiraEm: z.string(),
    criadoPor: z.string().uuid(),
    dataCriacao: z.string(),
  }),
});

export type FamiliaCreateInviteResponse = z.infer<typeof familiaCreateInviteResponseSchema>;

export const familiaJoinByInviteParamsSchema = z.object({
  codigo: z.string().trim().min(1),
});

export type FamiliaJoinByInviteParams = z.infer<typeof familiaJoinByInviteParamsSchema>;

export const familiaJoinByInviteRequestSchema = z.object({});

export type FamiliaJoinByInviteRequest = z.infer<typeof familiaJoinByInviteRequestSchema>;

export const familiaJoinByInviteResponseSchema = z.object({
  familia: z.object({
    id: z.string().uuid(),
    nome: z.string().min(1),
    dataCriacao: z.string(),
  }),
});

export type FamiliaJoinByInviteResponse = z.infer<typeof familiaJoinByInviteResponseSchema>;

export const familiaRequestJoinRequestSchema = z.object({
  familiaId: z.string().uuid(),
});

export type FamiliaRequestJoinRequest = z.infer<typeof familiaRequestJoinRequestSchema>;

export const familiaRequestJoinResponseSchema = z.object({
  solicitacao: z.object({
    id: z.string().uuid(),
    familiaId: z.string().uuid(),
    usuarioId: z.string().uuid(),
    status: z.literal('pendente'),
    solicitadoEm: z.string(),
  }),
});

export type FamiliaRequestJoinResponse = z.infer<typeof familiaRequestJoinResponseSchema>;

export const familiaListJoinRequestsResponseSchema = z.object({
  solicitacoes: z.array(
    z.object({
      id: z.string().uuid(),
      familiaId: z.string().uuid(),
      usuarioId: z.string().uuid(),
      status: z.literal('pendente'),
      solicitadoEm: z.string(),
    }),
  ),
});

export type FamiliaListJoinRequestsResponse = z.infer<typeof familiaListJoinRequestsResponseSchema>;

export const familiaReviewJoinRequestParamsSchema = z.object({
  id: z.string().uuid(),
});

export type FamiliaReviewJoinRequestParams = z.infer<typeof familiaReviewJoinRequestParamsSchema>;

export const familiaReviewJoinRequestRequestSchema = z.object({
  acao: z.enum(['aprovar', 'rejeitar']),
});

export type FamiliaReviewJoinRequestRequest = z.infer<typeof familiaReviewJoinRequestRequestSchema>;

export const familiaReviewJoinRequestResponseSchema = z.object({
  solicitacao: z.object({
    id: z.string().uuid(),
    familiaId: z.string().uuid(),
    usuarioId: z.string().uuid(),
    status: z.enum(['aprovada', 'rejeitada']),
    solicitadoEm: z.string(),
    respondidoEm: z.string(),
    respondidoPor: z.string().uuid(),
  }),
});

export type FamiliaReviewJoinRequestResponse = z.infer<typeof familiaReviewJoinRequestResponseSchema>;

export const familiaListMembersParamsSchema = z.object({
  id: z.string().uuid(),
});

export type FamiliaListMembersParams = z.infer<typeof familiaListMembersParamsSchema>;

export const familiaListMembersResponseSchema = z.object({
  membros: z.array(
    z.object({
      usuarioId: z.string().uuid(),
      familiaId: z.string().uuid(),
      role: z.enum(['admin', 'membro']),
      dataEntrada: z.string(),
    }),
  ),
});

export type FamiliaListMembersResponse = z.infer<typeof familiaListMembersResponseSchema>;

export const familiaRemoveMemberParamsSchema = z.object({
  id: z.string().uuid(),
  usuarioId: z.string().uuid(),
});

export type FamiliaRemoveMemberParams = z.infer<typeof familiaRemoveMemberParamsSchema>;

export const familiaSwitchActiveRequestSchema = z.object({
  familiaId: z.string().uuid(),
});

export type FamiliaSwitchActiveRequest = z.infer<typeof familiaSwitchActiveRequestSchema>;

export const familiaSwitchActiveResponseSchema = z.object({
  familiaIdAtiva: z.string().uuid(),
});

export type FamiliaSwitchActiveResponse = z.infer<typeof familiaSwitchActiveResponseSchema>;

export const familiaDeleteParamsSchema = z.object({
  id: z.string().uuid(),
});

export type FamiliaDeleteParams = z.infer<typeof familiaDeleteParamsSchema>;

export const categoriaListResponseSchema = z.object({
  categorias: z.array(
    z.object({
      id: z.string().uuid(),
      familiaId: z.string().uuid(),
      nome: z.string().min(1),
      tipo: categoriaTipoSchema,
      ativo: z.boolean(),
      criadoPor: z.string().uuid(),
      criadoEm: z.string(),
    }),
  ),
});

export type CategoriaListResponse = z.infer<typeof categoriaListResponseSchema>;

export const categoriaCreateRequestSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: categoriaTipoSchema,
});

export type CategoriaCreateRequest = z.infer<typeof categoriaCreateRequestSchema>;

export const categoriaCreateResponseSchema = z.object({
  categoria: z.object({
    id: z.string().uuid(),
    familiaId: z.string().uuid(),
    nome: z.string().min(1),
    tipo: categoriaTipoSchema,
    ativo: z.boolean(),
    criadoPor: z.string().uuid(),
    criadoEm: z.string(),
  }),
});

export type CategoriaCreateResponse = z.infer<typeof categoriaCreateResponseSchema>;

export const categoriaUpdateParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CategoriaUpdateParams = z.infer<typeof categoriaUpdateParamsSchema>;

export const categoriaUpdateRequestSchema = z.object({
  nome: z.string().trim().min(1),
  tipo: categoriaTipoSchema,
});

export type CategoriaUpdateRequest = z.infer<typeof categoriaUpdateRequestSchema>;

export const categoriaUpdateResponseSchema = categoriaCreateResponseSchema;

export type CategoriaUpdateResponse = z.infer<typeof categoriaUpdateResponseSchema>;
