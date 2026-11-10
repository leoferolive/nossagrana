import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import type { AcessoFamilia } from '../shared/familia-access/familia-access.repository.js';
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
  request: FastifyRequest,
  verificador: VerificadorAcessoFamilia,
  usuarioId: string,
  familiaId: string,
) {
  try {
    return await verificador.verificar(usuarioId, familiaId);
  } catch (err) {
    // Falha fechada: indisponibilidade do verificador nunca libera acesso.
    request.log.error({ err, familiaId }, `Falha ao verificar acesso à família ${familiaId}`);
    return null;
  }
}

/**
 * Recusa de acesso: 403 é definitivo (cliente WS não reconecta); a indisponibilidade
 * do verificador é 503 para ser tratada como transitória, com backoff (#79).
 */
function responderFalhaDeAcesso(
  reply: FastifyReply,
  acesso: Exclude<AcessoFamilia, 'ativa'> | null,
) {
  if (acesso === null) {
    reply.code(503).send({
      error: {
        message: 'Nao foi possivel verificar o acesso a familia',
        code: 'FAMILIA_ACESSO_INDISPONIVEL',
      },
    });
    return;
  }
  reply.code(403).send({ error: RECUSAS[acesso] });
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

    const acesso = await consultarAcesso(
      request,
      fastify.verificadorAcessoFamilia,
      userId,
      familiaId,
    );
    if (acesso !== 'ativa') {
      responderFalhaDeAcesso(reply, acesso);
      return;
    }

    request.familiaIdAtiva = familiaId;
  });
});
