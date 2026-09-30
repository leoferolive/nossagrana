import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import {
  type AcessoFamilia,
  verificarAcessoFamilia,
} from '../../shared/familia-access/familia-access.repository.js';
import {
  WS_CLOSE_ERRO_INTERNO,
  WS_CLOSE_FAMILIA_EXCLUIDA,
  WS_CLOSE_NAO_AUTENTICADO,
  WS_CLOSE_SESSAO_REVOGADA,
  WS_MOTIVO_NAO_AUTENTICADO,
} from './ws-close-codes.js';

const RECUSAS_DE_ACESSO = {
  sem_acesso: { codigo: 4003, motivo: 'Usuario sem acesso a familia' },
  excluida: { codigo: WS_CLOSE_FAMILIA_EXCLUIDA, motivo: 'Familia excluida' },
} as const;

/** Quem abriu o socket: `iat` (segundos) é o que permite comparar com a revogação global (#119). */
interface CredencialDoSocket {
  userId: string;
  emitidoEm: number | undefined;
}

function entrarNoRoom(
  fastify: FastifyInstance,
  socket: WebSocket,
  familiaId: string,
  userId: string,
): void {
  fastify.wsManager.join(familiaId, socket, userId);
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
 * Falha em qualquer checagem fecha o socket (1011): nunca fica conectado sem checagem.
 */
async function admitirComRevalidacao(
  fastify: FastifyInstance,
  socket: WebSocket,
  userId: string,
  familiaId: string,
): Promise<void> {
  try {
    const primeira = await verificarAcessoFamilia(db, userId, familiaId);
    if (recusarSeSemAcesso(fastify, socket, familiaId, primeira)) return;
    // O `close` do cliente durante o `await` acima já passou: entrar agora deixaria
    // o socket no room para sempre (o listener de `close` só nasce no `join`).
    if (socket.readyState !== socket.OPEN) return;

    entrarNoRoom(fastify, socket, familiaId, userId);
    const segunda = await verificarAcessoFamilia(db, userId, familiaId);
    recusarSeSemAcesso(fastify, socket, familiaId, segunda);
  } catch (err) {
    fastify.log.error(
      { err, familiaId },
      `Falha ao validar acesso do socket à família ${familiaId}`,
    );
    fastify.wsManager.leave(familiaId, socket);
    socket.close(WS_CLOSE_ERRO_INTERNO, 'Erro ao validar acesso');
  }
}

/**
 * Recusa o socket se a sessão dele foi revogada (#119); devolve `true` quando recusou.
 * O `iat` do access comparado com o instante da revogação impede que o token emitido
 * antes da troca de senha reconecte durante a janela de vida dele.
 */
async function recusarSeSessaoRevogada(
  fastify: FastifyInstance,
  socket: WebSocket,
  familiaId: string,
  credencial: CredencialDoSocket,
): Promise<boolean> {
  const revogada = await fastify.sessoes.estaRevogada(credencial.userId, credencial.emitidoEm);
  if (!revogada) return false;
  fastify.wsManager.leave(familiaId, socket);
  socket.close(WS_CLOSE_SESSAO_REVOGADA, 'Sessao revogada');
  return true;
}

/** Em NODE_ENV=test o vínculo com a família não é checado (repositórios InMemory separados). */
async function entrarValidandoFamilia(
  fastify: FastifyInstance,
  socket: WebSocket,
  familiaId: string,
  userId: string,
): Promise<void> {
  if (env.NODE_ENV === 'test') {
    entrarNoRoom(fastify, socket, familiaId, userId);
    return;
  }
  await admitirComRevalidacao(fastify, socket, userId, familiaId);
}

/**
 * Sessão, depois família, depois sessão de novo (#119). A revogação publica
 * `sessao:revogadas` só depois do commit; um handshake que passou da 1ª checagem
 * mas ainda não deu `join` perderia o evento. A 2ª checagem roda com o socket já
 * no room: se a revogação commitou depois dela, o evento chega depois do `join` e
 * `closeUser` fecha o socket; se commitou antes, a 2ª checagem a vê. Mesmo
 * raciocínio do #147. Falha em qualquer checagem fecha o socket (1011).
 */
async function admitirSocket(
  fastify: FastifyInstance,
  socket: WebSocket,
  familiaId: string,
  credencial: CredencialDoSocket,
): Promise<void> {
  try {
    if (await recusarSeSessaoRevogada(fastify, socket, familiaId, credencial)) return;
    if (socket.readyState !== socket.OPEN) return;

    await entrarValidandoFamilia(fastify, socket, familiaId, credencial.userId);
    if (socket.readyState !== socket.OPEN) return;

    await recusarSeSessaoRevogada(fastify, socket, familiaId, credencial);
  } catch (err) {
    fastify.log.error({ err, familiaId }, 'Falha ao validar a sessão do socket');
    fastify.wsManager.leave(familiaId, socket);
    socket.close(WS_CLOSE_ERRO_INTERNO, 'Erro ao validar sessao');
  }
}

/** Query do handshake: só ticket e família. Qualquer outro parâmetro (inclusive `token`) é ignorado. */
const handshakeQuerySchema = z.object({
  ticket: z.string().min(1).max(256),
  familiaId: z.string().uuid(),
});

/** Credencial já vinculada a uma família: é a do ticket, não a que o cliente alega na query. */
type CredencialDoHandshake = CredencialDoSocket & { familiaId: string };

/**
 * Consome o ticket do handshake (#118). `null` = recusar, sem distinguir o motivo:
 * parâmetros malformados, ticket inexistente, expirado, já usado ou de outra família.
 * Lança se o store falhar (o chamador fecha com 1011, falha fechada).
 */
async function autenticarPorTicket(
  fastify: FastifyInstance,
  query: unknown,
): Promise<CredencialDoHandshake | null> {
  const parametros = handshakeQuerySchema.safeParse(query);
  if (!parametros.success) return null;

  const { ticket, familiaId } = parametros.data;
  return fastify.wsTickets.consumir(ticket, familiaId);
}

function recusarNaoAutenticado(socket: WebSocket): void {
  socket.close(WS_CLOSE_NAO_AUTENTICADO, WS_MOTIVO_NAO_AUTENTICADO);
}

/**
 * Handshake sem JWT na URL (#118): o cliente troca o access por um ticket de uso único via
 * `POST /ws/ticket` e o apresenta aqui. O ticket é consumido antes de qualquer outra checagem.
 * Depois, sessão e família são revalidadas por `admitirSocket` (#119, #147).
 */
export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (socket: WebSocket, request) => {
    let credencial: CredencialDoHandshake | null;
    try {
      credencial = await autenticarPorTicket(fastify, request.query);
    } catch (err) {
      fastify.log.error({ err }, 'Falha ao consumir o ticket do WebSocket');
      socket.close(WS_CLOSE_ERRO_INTERNO, 'Erro ao validar ticket');
      return;
    }
    if (!credencial) {
      recusarNaoAutenticado(socket);
      return;
    }

    await admitirSocket(fastify, socket, credencial.familiaId, credencial);
  });
};
