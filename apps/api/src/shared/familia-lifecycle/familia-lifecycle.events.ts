import type EventEmitter from 'node:events';

export const FAMILIA_EXCLUIDA_EVENTO = 'familia:excluida';

/** Payload mínimo: só o id (sem nome, membros ou convites) para não vazar dados. */
export interface FamiliaExcluidaEvento {
  familiaId: string;
}

/**
 * Porta pela qual o módulo `familia` avisa o resto da app sobre mudanças de
 * ciclo de vida, sem conhecer quem escuta (ex.: o gerenciador de WebSocket).
 */
export interface FamiliaLifecyclePublisher {
  familiaExcluida(familiaId: string): void;
}

/** Publisher que não faz nada: usado quando não há barramento de eventos registrado. */
export class NoopFamiliaLifecyclePublisher implements FamiliaLifecyclePublisher {
  familiaExcluida(): void {}
}

/** Publica no `eventBus` do Fastify. Ex.: `new EventBusFamiliaLifecyclePublisher(app.eventBus)`. */
export class EventBusFamiliaLifecyclePublisher implements FamiliaLifecyclePublisher {
  constructor(private readonly eventBus: EventEmitter) {}

  familiaExcluida(familiaId: string): void {
    const evento: FamiliaExcluidaEvento = { familiaId };
    this.eventBus.emit(FAMILIA_EXCLUIDA_EVENTO, evento);
  }
}

export function ehFamiliaExcluidaEvento(valor: unknown): valor is FamiliaExcluidaEvento {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as { familiaId?: unknown }).familiaId === 'string'
  );
}
