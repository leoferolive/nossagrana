import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import {
  type AcessoFamilia,
  verificarAcessoFamilia,
} from '../../shared/familia-access/familia-access.repository.js';
import { WS_CLOSE_ERRO_INTERNO, WS_CLOSE_FAMILIA_EXCLUIDA } from './ws-close-codes.js';

const RECUSAS_DE_ACESSO = {
  sem_acesso: { codigo: 4003, motivo: 'Usuario sem acesso a familia' },
  excluida: { codigo: WS_CLOSE_FAMILIA_EXCLUIDA, motivo: 'Familia excluida' },
} as const;

function entrarNoRoom(fastify: FastifyInstance, socket: WebSocket, familiaId: string): void {
  fastify.wsManager.join(familiaId, socket);
  socket.on('close', () => {
    fastify.wsManager.leave(familiaId, socket);
  });
}

/**
 * Recusa o socket se o acesso não for `ativa`; devolve `true` quando recusou.
 * Também tira o socket do room na hora (o evento `close` só chega depois).
 */
function recusarSeSemAcesso(
  fastify: FastifyInstance,
  socket: WebSocket,
  familiaId: string,
  acesso: AcessoFamilia,
): boolean {
  if (acesso === 'ativa') return false;
  fastify.wsManager.leave(familiaId, socket);
  socket.close(RECUSAS_DE_ACESSO[acesso].codigo, RECUSAS_DE_ACESSO[acesso].motivo);
  return true;
}

/**
 * Checa o acesso, entra no room e CHECA DE NOVO (#147). A exclusão publica
 * `familia:excluida` só depois do commit; um handshake que já passou da 1ª
 * checagem mas ainda não deu `join` perderia esse evento e ficaria conectado a
 * uma família excluída. Se a 2ª checagem (feita já com o socket no room) ainda
 * vê a família ativa, a exclusão commita depois dela — logo o evento chega
 * depois do `join` e `closeFamily` fecha o socket. Sem memória de famílias
 * fechadas, uma família restaurada por admin reabre sockets normalmente.
 * Falha ao revalidar fecha o socket (1011): nunca fica conectado sem checagem.
 */
async function admitirComRevalidacao(
  fastify: FastifyInstance,
  socket: WebSocket,
  userId: string,
  familiaId: string,
): Promise<void> {
  const primeira = await verificarAcessoFamilia(db, userId, familiaId);
  if (recusarSeSemAcesso(fastify, socket, familiaId, primeira)) return;

  entrarNoRoom(fastify, socket, familiaId);
  try {
    const segunda = await verificarAcessoFamilia(db, userId, familiaId);
    recusarSeSemAcesso(fastify, socket, familiaId, segunda);
  } catch (err) {
    fastify.log.error(
      { err, familiaId },
      `Falha ao revalidar acesso do socket à família ${familiaId}`,
    );
    fastify.wsManager.leave(familiaId, socket);
    socket.close(WS_CLOSE_ERRO_INTERNO, 'Erro ao validar acesso');
  }
}

export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (socket: WebSocket, request) => {
    const query = request.query as Record<string, string>;
    const token = query.token;
    const familiaId = query.familiaId;

    // Valida UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!token || !familiaId || !uuidRegex.test(familiaId)) {
      socket.close(4001, 'Parametros invalidos');
      return;
    }

    // Valida JWT
    let userId: string;
    try {
      const payload = fastify.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.close(4001, 'Token invalido ou expirado');
      return;
    }

    // Verifica acesso à família (bypass em test)
    if (env.NODE_ENV !== 'test') {
      await admitirComRevalidacao(fastify, socket, userId, familiaId);
      return;
    }

    entrarNoRoom(fastify, socket, familiaId);
  });
};
