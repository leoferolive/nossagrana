import type { FamiliaLifecyclePublisher } from '../familia-lifecycle.events.js';

/** Fake nomeada do barramento de ciclo de vida da família: registra o que foi publicado. */
export class FamiliaLifecyclePublisherFake implements FamiliaLifecyclePublisher {
  readonly excluidas: string[] = [];
  readonly membrosRemovidos: Array<{ familiaId: string; usuarioId: string }> = [];

  familiaExcluida(familiaId: string): void {
    this.excluidas.push(familiaId);
  }

  membroRemovido(familiaId: string, usuarioId: string): void {
    this.membrosRemovidos.push({ familiaId, usuarioId });
  }
}
