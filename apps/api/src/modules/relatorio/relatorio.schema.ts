import { z } from 'zod';

const distribuicaoItemZod = z.object({
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});

const porUsuarioItemZod = z.object({
  usuarioId: z.string().uuid(),
  usuarioNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});

const tendenciaMesZod = z.object({
  mesReferencia: z.string(),
  totalReceitas: z.string(),
  totalDespesas: z.string(),
  saldo: z.string(),
});

export const relatorioDistribuicaoSchema = {
  querystring: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  response: {
    200: z.object({
      mesReferencia: z.string(),
      distribuicao: z.array(distribuicaoItemZod),
    }),
  },
};

export const relatorioPorUsuarioSchema = {
  querystring: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  response: {
    200: z.object({
      mesReferencia: z.string(),
      porUsuario: z.array(porUsuarioItemZod),
    }),
  },
};

export const relatorioTendenciasSchema = {
  querystring: z.object({ meses: z.coerce.number().int().min(1).max(24).optional() }),
  response: { 200: z.object({ meses: z.array(tendenciaMesZod) }) },
};
