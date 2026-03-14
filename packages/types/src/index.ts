import { z } from 'zod';

export const familyRoleSchema = z.enum(['admin', 'membro']);
export type FamilyRole = z.infer<typeof familyRoleSchema>;

export const transactionTypeSchema = z.enum(['receita', 'despesa']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

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

// ─── Familia ────────────────────────────────────────────────────────────────

export const criarFamiliaRequestSchema = z.object({
  nome: z.string().trim().min(1),
});

export type CriarFamiliaRequest = z.infer<typeof criarFamiliaRequestSchema>;

export const familiaResponseSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  role: familyRoleSchema,
  dataCriacao: z.string(),
});

export type FamiliaResponse = z.infer<typeof familiaResponseSchema>;

export const membroResponseSchema = z.object({
  usuarioId: z.string().uuid(),
  nome: z.string(),
  email: z.string().email(),
  role: familyRoleSchema,
  dataEntrada: z.string(),
});

export type MembroResponse = z.infer<typeof membroResponseSchema>;

export const gerarConviteResponseSchema = z.object({
  codigo: z.string(),
  expiraEm: z.string(),
});

export type GerarConviteResponse = z.infer<typeof gerarConviteResponseSchema>;

export const entrarViaConviteRequestSchema = z.object({
  codigo: z.string().min(1),
});

export type EntrarViaConviteRequest = z.infer<typeof entrarViaConviteRequestSchema>;

export const solicitarEntradaRequestSchema = z.object({
  familiaId: z.string().uuid(),
});

export type SolicitarEntradaRequest = z.infer<typeof solicitarEntradaRequestSchema>;

export const solicitacaoResponseSchema = z.object({
  id: z.string().uuid(),
  familiaId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  status: z.enum(['pendente', 'aprovada', 'rejeitada']),
  solicitadoEm: z.string(),
});

export type SolicitacaoResponse = z.infer<typeof solicitacaoResponseSchema>;

export const avaliarSolicitacaoRequestSchema = z.object({
  acao: z.enum(['aprovar', 'rejeitar']),
});

export type AvaliarSolicitacaoRequest = z.infer<typeof avaliarSolicitacaoRequestSchema>;

export const alternarFamiliaRequestSchema = z.object({
  familiaId: z.string().uuid(),
});

export type AlternarFamiliaRequest = z.infer<typeof alternarFamiliaRequestSchema>;
