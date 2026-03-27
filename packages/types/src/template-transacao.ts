import { z } from 'zod';

// --- Entity ---
export const templateTransacaoSchema = z.object({
  id: z.string().uuid(),
  familiaId: z.string().uuid(),
  nome: z.string().min(1),
  tipo: z.enum(['receita', 'despesa']),
  categoriaId: z.string().uuid().nullable(),
  metodoPagamentoId: z.string().uuid().nullable(),
  cofrinhoId: z.string().uuid().nullable(),
  ordem: z.number().int(),
  valorPadrao: z.string().nullable(),
  ativo: z.boolean(),
  criadoPor: z.string().uuid(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type TemplateTransacao = z.infer<typeof templateTransacaoSchema>;

// --- List response (com joins) ---
export const templateTransacaoListItemSchema = templateTransacaoSchema.extend({
  categoriaNome: z.string().nullable(),
  metodoPagamentoNome: z.string().nullable(),
  cofrinhoNome: z.string().nullable(),
  cofrinhoEmoji: z.string().nullable(),
});
export type TemplateTransacaoListItem = z.infer<typeof templateTransacaoListItemSchema>;

export const templateTransacaoListResponseSchema = z.object({
  templates: z.array(templateTransacaoListItemSchema),
});
export type TemplateTransacaoListResponse = z.infer<typeof templateTransacaoListResponseSchema>;

// --- Create request ---
export const templateTransacaoCreateRequestSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(['receita', 'despesa']),
  categoriaId: z.string().uuid().nullable().optional(),
  metodoPagamentoId: z.string().uuid().nullable().optional(),
  cofrinhoId: z.string().uuid().nullable().optional(),
  valorPadrao: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  ordem: z.number().int().min(0).optional().default(0),
});
export type TemplateTransacaoCreateRequest = z.infer<typeof templateTransacaoCreateRequestSchema>;

export const templateTransacaoCreateResponseSchema = z.object({
  template: templateTransacaoSchema,
});
export type TemplateTransacaoCreateResponse = z.infer<typeof templateTransacaoCreateResponseSchema>;

// --- Update request ---
export const templateTransacaoUpdateRequestSchema = z.object({
  nome: z.string().trim().min(1).max(200).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  metodoPagamentoId: z.string().uuid().nullable().optional(),
  cofrinhoId: z.string().uuid().nullable().optional(),
  valorPadrao: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  ordem: z.number().int().min(0).optional(),
});
export type TemplateTransacaoUpdateRequest = z.infer<typeof templateTransacaoUpdateRequestSchema>;

export const templateTransacaoUpdateParamsSchema = z.object({
  id: z.string().uuid(),
});

export const templateTransacaoDeleteParamsSchema = z.object({
  id: z.string().uuid(),
});

// --- Aplicar request ---
export const templateTransacaoAplicarItemSchema = z.object({
  templateId: z.string().uuid(),
  valor: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const templateTransacaoAplicarRequestSchema = z.object({
  mesReferencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  itens: z.array(templateTransacaoAplicarItemSchema).min(1),
});
export type TemplateTransacaoAplicarRequest = z.infer<typeof templateTransacaoAplicarRequestSchema>;

export const templateTransacaoAplicarResponseSchema = z.object({
  transacoesCriadas: z.number().int(),
  aportesCriados: z.number().int(),
  total: z.number().int(),
});
export type TemplateTransacaoAplicarResponse = z.infer<typeof templateTransacaoAplicarResponseSchema>;

// --- Reordenar request ---
export const templateTransacaoReordenarItemSchema = z.object({
  id: z.string().uuid(),
  ordem: z.number().int().min(0),
});

export const templateTransacaoReordenarRequestSchema = z.object({
  itens: z.array(templateTransacaoReordenarItemSchema).min(1),
});
export type TemplateTransacaoReordenarRequest = z.infer<typeof templateTransacaoReordenarRequestSchema>;

// --- List query ---
export const templateTransacaoListQuerySchema = z.object({
  tipo: z.enum(['receita', 'despesa']).optional(),
});
