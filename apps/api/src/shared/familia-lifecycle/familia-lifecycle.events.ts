import type EventEmitter from 'node:events';

export const FAMILIA_EXCLUIDA_EVENTO = 'familia:excluida';

export const FAMILIA_MEMBRO_REMOVIDO_EVENTO = 'familia:membro-removido';

/** Payload mínimo: só o id (sem nome, membros ou convites) para não vazar dados. */
export interface FamiliaExcluidaEvento {
  familiaId: string;
}

/** Payload mínimo: só os ids da família e do usuário removido (#119). */
export interface FamiliaMembroRemovidoEvento {
  familiaId: string;
  usuarioId: string;
}

/**
 * Porta pela qual o módulo `familia` avisa o resto da app sobre mudanças de
 * ciclo de vida, sem conhecer quem escuta (ex.: o gerenciador de WebSocket).
 */
export interface FamiliaLifecyclePublisher {
  familiaExcluida(familiaId: string): void;
  membroRemovido(familiaId: string, usuarioId: string): void;
}

/** Publisher que não faz nada: usado quando não há barramento de eventos registrado. */
export class NoopFamiliaLifecyclePublisher implements FamiliaLifecyclePublisher {
  familiaExcluida(): void {}
  membroRemovido(): void {}
}

/** Subconjunto do logger do Fastify usado pelo publisher (`app.log` satisfaz a interface). */
export interface FamiliaLifecycleLogger {
  error(contexto: object, mensagem: string): void;
}

/**
 * Publica no `eventBus` do Fastify. Ex.: `new EventBusFamiliaLifecyclePublisher(app.eventBus, app.log)`.
 *
 * O efeito colateral é best-effort: `emit` é síncrono e um listener que lança
 * (hoje ou no futuro) não pode transformar uma exclusão já commitada em 500.
 * A falha é logada e engolida.
 */
export class EventBusFamiliaLifecyclePublisher implements FamiliaLifecyclePublisher {
  constructor(
    private readonly eventBus: EventEmitter,
    private readonly log: FamiliaLifecycleLogger,
  ) {}

  familiaExcluida(familiaId: string): void {
    const evento: FamiliaExcluidaEvento = { familiaId };
    try {
      this.eventBus.emit(FAMILIA_EXCLUIDA_EVENTO, evento);
    } catch (err) {
      this.log.error(
        { err, familiaId },
        `Falha ao publicar ${FAMILIA_EXCLUIDA_EVENTO}: a exclusão da família ${familiaId} já foi gravada e segue válida`,
      );
    }
  }

  membroRemovido(familiaId: string, usuarioId: string): void {
    const evento: FamiliaMembroRemovidoEvento = { familiaId, usuarioId };
    try {
      this.eventBus.emit(FAMILIA_MEMBRO_REMOVIDO_EVENTO, evento);
    } catch (err) {
      this.log.error(
        { err, familiaId, usuarioId },
        `Falha ao publicar ${FAMILIA_MEMBRO_REMOVIDO_EVENTO}: a remoção do usuário ${usuarioId} da família ${familiaId} já foi gravada e segue válida`,
      );
    }
  }
}

export function ehFamiliaMembroRemovidoEvento(
  valor: unknown,
): valor is FamiliaMembroRemovidoEvento {
  if (typeof valor !== 'object' || valor === null) return false;
  const { familiaId, usuarioId } = valor as { familiaId?: unknown; usuarioId?: unknown };
  return typeof familiaId === 'string' && typeof usuarioId === 'string';
}

export function ehFamiliaExcluidaEvento(valor: unknown): valor is FamiliaExcluidaEvento {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as { familiaId?: unknown }).familiaId === 'string'
  );
}
