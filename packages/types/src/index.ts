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
