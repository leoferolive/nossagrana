import type EventEmitter from 'node:events';

import type { FamiliaLifecycleLogger } from '../familia-lifecycle/familia-lifecycle.events.js';

export const SESSOES_REVOGADAS_EVENTO = 'sessao:revogadas';

/** Payload mínimo: só o id do usuário (sem e-mail, tokens ou hashes) para não vazar dados. */
export interface SessoesRevogadasEvento {
  userId: string;
}

/**
 * Porta pela qual o módulo `auth` avisa o resto da app que todas as sessões de
 * um usuário foram revogadas (#119), sem conhecer quem escuta (ex.: o
 * gerenciador de WebSocket). Mesmo padrão de `FamiliaLifecyclePublisher`.
 */
export interface SessaoLifecyclePublisher {
  sessoesRevogadas(userId: string): void;
}

/** Publisher que não faz nada: usado quando não há barramento de eventos registrado. */
export class NoopSessaoLifecyclePublisher implements SessaoLifecyclePublisher {
  sessoesRevogadas(): void {}
}

/**
 * Publica no `eventBus` do Fastify. Ex.: `new EventBusSessaoLifecyclePublisher(app.eventBus, app.log)`.
 *
 * Best-effort como o de família: `emit` é síncrono e um listener que lança não
 * pode transformar uma revogação já commitada em 500. A falha é logada e engolida.
 */
export class EventBusSessaoLifecyclePublisher implements SessaoLifecyclePublisher {
  constructor(
    private readonly eventBus: EventEmitter,
    private readonly log: FamiliaLifecycleLogger,
  ) {}

  sessoesRevogadas(userId: string): void {
    const evento: SessoesRevogadasEvento = { userId };
    try {
      this.eventBus.emit(SESSOES_REVOGADAS_EVENTO, evento);
    } catch (err) {
      this.log.error(
        { err, userId },
        `Falha ao publicar ${SESSOES_REVOGADAS_EVENTO}: a revogação das sessões do usuário ${userId} já foi gravada e segue válida`,
      );
    }
  }
}

export function ehSessoesRevogadasEvento(valor: unknown): valor is SessoesRevogadasEvento {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as { userId?: unknown }).userId === 'string'
  );
}
