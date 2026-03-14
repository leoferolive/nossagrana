import {
  alternarFamiliaRequestSchema,
  avaliarSolicitacaoRequestSchema,
  criarFamiliaRequestSchema,
  entrarViaConviteRequestSchema,
  solicitarEntradaRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleFamiliaRepository, InMemoryFamiliaRepository } from './familia.repository.js';
import {
  alternarFamiliaSchema,
  avaliarSolicitacaoSchema,
  criarFamiliaSchema,
  entrarViaConviteSchema,
  excluirFamiliaSchema,
  gerarConviteSchema,
  listarFamiliasSchema,
  listarMembrosSchema,
  listarSolicitacoesSchema,
  removerMembroSchema,
  solicitarEntradaSchema,
} from './familia.schema.js';
import {
  ConviteExpiradoError,
  ConviteInvalidoError,
  FamiliaService,
  MembroJaExisteError,
  NaoAutorizadoError,
  SolicitacaoNaoEncontradaError,
} from './familia.service.js';

const defaultFamiliaService = () => {
  const repo = env.NODE_ENV === 'test' ? new InMemoryFamiliaRepository() : new DrizzleFamiliaRepository();
  return new FamiliaService(repo);
};

export const familiaRoutes: FastifyPluginAsync = async (fastify) => {
  const familiaService = defaultFamiliaService();

  // POST /familias — criar família (UC05)
  fastify.post(
    '/familias',
    { preHandler: [fastify.authenticate], schema: criarFamiliaSchema },
    async (request, reply) => {
      const { nome } = criarFamiliaRequestSchema.parse(request.body);
      const familia = await familiaService.criarFamilia({ nome, adminUserId: request.user.sub });
      return reply.code(201).send(familia);
    },
  );

  // GET /familias — listar famílias do usuário (UC20)
  fastify.get(
    '/familias',
    { preHandler: [fastify.authenticate], schema: listarFamiliasSchema },
    async (request) => {
      const familias = await familiaService.listarFamilias(request.user.sub);
      return familias.map((f) => ({ ...f, dataCriacao: f.dataCriacao.toISOString() }));
    },
  );

  // POST /familias/:id/convites — gerar convite (UC21)
  fastify.post(
    '/familias/:id/convites',
    { preHandler: [fastify.authenticate], schema: gerarConviteSchema },
    async (request, reply) => {
      try {
        const { id: familiaId } = (request.params as { id: string });
        const convite = await familiaService.gerarConvite({ familiaId, adminUserId: request.user.sub });
        return reply.code(201).send(convite);
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        throw error;
      }
    },
  );

  // POST /familias/entrar — entrar via convite (UC03)
  fastify.post(
    '/familias/entrar',
    { preHandler: [fastify.authenticate], schema: entrarViaConviteSchema },
    async (request, reply) => {
      try {
        const { codigo } = entrarViaConviteRequestSchema.parse(request.body);
        const membro = await familiaService.entrarViaConvite({ codigo, usuarioId: request.user.sub });
        return reply.code(200).send({ familiaId: membro.familiaId, role: membro.role });
      } catch (error) {
        if (error instanceof ConviteInvalidoError || error instanceof ConviteExpiradoError) {
          return reply.code(400).send({ message: error.message });
        }
        if (error instanceof MembroJaExisteError) return reply.code(409).send({ message: error.message });
        throw error;
      }
    },
  );

  // POST /familias/solicitar — solicitar entrada (UC04)
  fastify.post(
    '/familias/solicitar',
    { preHandler: [fastify.authenticate], schema: solicitarEntradaSchema },
    async (request, reply) => {
      try {
        const { familiaId } = solicitarEntradaRequestSchema.parse(request.body);
        const sol = await familiaService.solicitarEntrada({ familiaId, usuarioId: request.user.sub });
        return reply.code(201).send({ ...sol, solicitadoEm: sol.solicitadoEm.toISOString() });
      } catch (error) {
        if (error instanceof MembroJaExisteError) return reply.code(409).send({ message: error.message });
        throw error;
      }
    },
  );

  // GET /familias/:id/solicitacoes — listar solicitações pendentes (Admin)
  fastify.get(
    '/familias/:id/solicitacoes',
    { preHandler: [fastify.authenticate], schema: listarSolicitacoesSchema },
    async (request, reply) => {
      try {
        const { id: familiaId } = (request.params as { id: string });
        const solicitacoes = await familiaService.listarSolicitacoesPendentes({ familiaId, adminUserId: request.user.sub });
        return reply.code(200).send(solicitacoes.map((s) => ({ ...s, solicitadoEm: s.solicitadoEm.toISOString() })));
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        throw error;
      }
    },
  );

  // PATCH /familias/:id/solicitacoes/:solicitacaoId — aprovar/rejeitar (UC22)
  fastify.patch(
    '/familias/:id/solicitacoes/:solicitacaoId',
    { preHandler: [fastify.authenticate], schema: avaliarSolicitacaoSchema },
    async (request, reply) => {
      try {
        const { id: familiaId, solicitacaoId } = (request.params as { id: string; solicitacaoId: string });
        const { acao } = avaliarSolicitacaoRequestSchema.parse(request.body);
        const result = await familiaService.avaliarSolicitacao({
          solicitacaoId,
          familiaId,
          adminUserId: request.user.sub,
          acao,
        });
        return reply.code(200).send({ ...result, solicitadoEm: result.solicitadoEm.toISOString() });
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        if (error instanceof SolicitacaoNaoEncontradaError) return reply.code(404).send({ message: error.message });
        throw error;
      }
    },
  );

  // GET /familias/:id/membros — listar membros
  fastify.get(
    '/familias/:id/membros',
    { preHandler: [fastify.authenticate], schema: listarMembrosSchema },
    async (request, reply) => {
      try {
        const { id: familiaId } = (request.params as { id: string });
        const membros = await familiaService.listarMembros({ familiaId, usuarioId: request.user.sub });
        return reply.code(200).send(membros.map((m) => ({ ...m, dataEntrada: m.dataEntrada.toISOString() })));
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        throw error;
      }
    },
  );

  // DELETE /familias/:id/membros/:usuarioId — remover membro (UC23)
  fastify.delete(
    '/familias/:id/membros/:usuarioId',
    { preHandler: [fastify.authenticate], schema: removerMembroSchema },
    async (request, reply) => {
      try {
        const { id: familiaId, usuarioId: membroId } = (request.params as { id: string; usuarioId: string });
        await familiaService.removerMembro({ familiaId, membroId, adminUserId: request.user.sub });
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        throw error;
      }
    },
  );

  // DELETE /familias/:id — excluir família (UC24)
  fastify.delete(
    '/familias/:id',
    { preHandler: [fastify.authenticate], schema: excluirFamiliaSchema },
    async (request, reply) => {
      try {
        const { id: familiaId } = (request.params as { id: string });
        await familiaService.excluirFamilia({ familiaId, adminUserId: request.user.sub });
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        throw error;
      }
    },
  );

  // POST /familias/alternar — alternar família ativa (UC20)
  fastify.post(
    '/familias/alternar',
    { preHandler: [fastify.authenticate], schema: alternarFamiliaSchema },
    async (request, reply) => {
      try {
        const { familiaId } = alternarFamiliaRequestSchema.parse(request.body);
        const membro = await familiaService.listarMembros({ familiaId, usuarioId: request.user.sub });
        if (!membro.find((m) => m.usuarioId === request.user.sub)) {
          return reply.code(403).send({ message: 'Nao autorizado' });
        }
        return reply.code(200).send({ familiaId });
      } catch (error) {
        if (error instanceof NaoAutorizadoError) return reply.code(403).send({ message: error.message });
        throw error;
      }
    },
  );
};
