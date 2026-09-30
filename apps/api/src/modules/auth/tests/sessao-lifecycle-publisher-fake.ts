import type { SessaoLifecyclePublisher } from '../../../shared/sessao-lifecycle/sessao-lifecycle.events.js';

/**
 * Fake nomeada do barramento de ciclo de vida da sessão: registra os usuários
 * cujas sessões foram revogadas, na ordem, e o "instante lógico" da publicação
 * frente às escritas do teste (via `aoPublicar`).
 */
export class SessaoLifecyclePublisherFake implements SessaoLifecyclePublisher {
  readonly usuariosRevogados: string[] = [];

  constructor(private readonly aoPublicar: () => void = () => undefined) {}

  sessoesRevogadas(userId: string): void {
    this.aoPublicar();
    this.usuariosRevogados.push(userId);
  }
}
