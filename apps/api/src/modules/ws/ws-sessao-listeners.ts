import type EventEmitter from 'node:events';

import {
  ehFamiliaMembroRemovidoEvento,
  FAMILIA_MEMBRO_REMOVIDO_EVENTO,
} from '../../shared/familia-lifecycle/familia-lifecycle.events.js';
import {
  ehSessoesRevogadasEvento,
  SESSOES_REVOGADAS_EVENTO,
} from '../../shared/sessao-lifecycle/sessao-lifecycle.events.js';
import type { WebSocketManager } from './websocket-manager.js';
import { WS_CLOSE_MEMBRO_REMOVIDO, WS_CLOSE_SESSAO_REVOGADA } from './ws-close-codes.js';

/** Subconjunto do logger do Fastify usado ao descartar eventos malformados. */
export interface OuvintesLogger {
  warn(contexto: object, mensagem: string): void;
}

/**
 * Liga os eventos de revogação de sessão e de remoção de membro (#119) ao
 * fechamento dos sockets afetados. Ambos são publicados só depois do commit.
 * Payload malformado é descartado com aviso (nunca fecha socket de ninguém).
 */
export function registrarOuvintesDeSessaoEMembro(
  eventBus: EventEmitter,
  wsManager: WebSocketManager,
  log: OuvintesLogger,
): void {
  eventBus.on(SESSOES_REVOGADAS_EVENTO, (evento: unknown) => {
    if (!ehSessoesRevogadasEvento(evento)) {
      log.warn(
        { evento },
        `Evento ${SESSOES_REVOGADAS_EVENTO} ignorado: recebido ${JSON.stringify(evento)}, esperado { userId: string }`,
      );
      return;
    }
    wsManager.closeUser(evento.userId, WS_CLOSE_SESSAO_REVOGADA, 'Sessao revogada');
  });

  eventBus.on(FAMILIA_MEMBRO_REMOVIDO_EVENTO, (evento: unknown) => {
    if (!ehFamiliaMembroRemovidoEvento(evento)) {
      log.warn(
        { evento },
        `Evento ${FAMILIA_MEMBRO_REMOVIDO_EVENTO} ignorado: recebido ${JSON.stringify(evento)}, esperado { familiaId: string, usuarioId: string }`,
      );
      return;
    }
    wsManager.closeUserInFamily(
      evento.familiaId,
      evento.usuarioId,
      WS_CLOSE_MEMBRO_REMOVIDO,
      'Membro removido',
    );
  });
}
