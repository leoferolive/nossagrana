import { relatorioQuerySchema, relatorioTendenciasQuerySchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleRelatorioRepository, InMemoryRelatorioRepository } from './relatorio.repository.js';
import {
  relatorioDistribuicaoSchema,
  relatorioPorUsuarioSchema,
  relatorioTendenciasSchema,
} from './relatorio.schema.js';
import { RelatorioService } from './relatorio.service.js';

function getCurrentMes(): string {
  const now = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const ano = partes.find((p) => p.type === 'year')!.value;
  const mes = partes.find((p) => p.type === 'month')!.value;
  return `${ano}-${mes}`;
}

const defaultService = () => {
  const repo =
    env.NODE_ENV === 'test' ? new InMemoryRelatorioRepository() : new DrizzleRelatorioRepository();
  return new RelatorioService(repo);
};

export const relatorioRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/relatorios/distribuicao',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: relatorioDistribuicaoSchema,
    },
    async (request) => {
      const { mesReferencia } = relatorioQuerySchema.parse(request.query);
      return service.distribuicao(
        request.familiaIdAtiva as string,
        mesReferencia ?? getCurrentMes(),
      );
    },
  );

  fastify.get(
    '/relatorios/por-usuario',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: relatorioPorUsuarioSchema,
    },
    async (request) => {
      const { mesReferencia } = relatorioQuerySchema.parse(request.query);
      return service.porUsuario(request.familiaIdAtiva as string, mesReferencia ?? getCurrentMes());
    },
  );

  fastify.get(
    '/relatorios/tendencias',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: relatorioTendenciasSchema,
    },
    async (request) => {
      const { meses } = relatorioTendenciasQuerySchema.parse(request.query);
      return service.tendencias(request.familiaIdAtiva as string, getCurrentMes(), meses ?? 6);
    },
  );
};
