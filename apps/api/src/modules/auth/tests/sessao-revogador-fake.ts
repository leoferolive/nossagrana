import type { SessaoRevogador } from '../auth.types.js';

/**
 * Fake nomeada de `SessaoRevogador`: registra para quais usuários a revogação
 * global foi pedida (e em que ordem, frente a outras escritas) sem tocar em
 * banco nem em sockets. `falharAoRevogar` simula a indisponibilidade do
 * armazenamento de revogação.
 */
export class SessaoRevogadorFake implements SessaoRevogador {
  readonly usuariosRevogados: string[] = [];

  constructor(
    private readonly falharAoRevogar = false,
    private readonly aoRevogar: () => void = () => undefined,
  ) {}

  async revogarTodas(userId: string): Promise<void> {
    if (this.falharAoRevogar) throw new Error('armazenamento de revogação indisponível');
    this.aoRevogar();
    this.usuariosRevogados.push(userId);
  }
}
