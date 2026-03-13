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
