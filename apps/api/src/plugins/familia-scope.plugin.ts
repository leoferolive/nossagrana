import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import {
  DrizzleVerificadorAcessoFamilia,
  type VerificadorAcessoFamilia,
} from '../shared/familia-access/verificador-acesso-familia.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireFamiliaScope: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Mesmo verificador de posse para HTTP e WebSocket (#79). */
    verificadorAcessoFamilia: VerificadorAcessoFamilia;
  }

  interface FastifyRequest {
    familiaIdAtiva?: string;
  }
}

export interface FamiliaScopeOpcoes {
  /** Padrão: PostgreSQL. Testes injetam uma fake nomeada; nenhum branch por NODE_ENV. */
  verificadorAcessoFamilia?: VerificadorAcessoFamilia;
}

const familiaHeaderSchema = z.string().uuid();

const RECUSAS = {
  sem_acesso: {
    message: 'Usuario sem acesso a familia informada',
    code: 'FAMILIA_SEM_ACESSO',
  },
  excluida: { message: 'Familia excluida', code: 'FAMILIA_EXCLUIDA' },
} as const;

function familiaIdDoHeader(request: FastifyRequest): string | null {
  const headerValue = request.headers['x-familia-id'];
  const bruto = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const parsed = familiaHeaderSchema.safeParse(bruto);
  return parsed.success ? parsed.data : null;
}

async function consultarAcesso(
  fastify: { verificadorAcessoFamilia: VerificadorAcessoFamilia; log: FastifyRequest['log'] },
  usuarioId: string,
  familiaId: string,
) {
  try {
    return await fastify.verificadorAcessoFamilia.verificar(usuarioId, familiaId);
  } catch (err) {
    // Falha fechada: indisponibilidade do verificador nunca libera acesso.
    fastify.log.error({ err, familiaId }, `Falha ao verificar acesso à família ${familiaId}`);
    return null;
  }
}

export const familiaScopePlugin = fp<FamiliaScopeOpcoes>(async (fastify, opcoes) => {
  fastify.decorate(
    'verificadorAcessoFamilia',
    opcoes.verificadorAcessoFamilia ?? new DrizzleVerificadorAcessoFamilia(),
  );

  fastify.decorate('requireFamiliaScope', async (request, reply) => {
    const familiaId = familiaIdDoHeader(request);
    if (!familiaId) {
      reply.code(400).send({ message: 'familia_id invalido ou ausente' });
      return;
    }

    const userId = request.user?.sub;
    if (!userId) {
      reply.code(401).send({ message: 'Nao autenticado' });
      return;
    }

    const acesso = await consultarAcesso(fastify, userId, familiaId);
    if (acesso === null) {
      reply.code(403).send({
        error: {
          message: 'Nao foi possivel verificar o acesso a familia',
          code: 'FAMILIA_ACESSO_INDISPONIVEL',
        },
      });
      return;
    }
    if (acesso !== 'ativa') {
      reply.code(403).send({ error: RECUSAS[acesso] });
      return;
    }

    request.familiaIdAtiva = familiaId;
  });
});
