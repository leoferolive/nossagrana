import type { SessaoLifecyclePublisher } from '../../shared/sessao-lifecycle/sessao-lifecycle.events.js';

import type { SessaoRevogador } from './auth.types.js';
import type { RevokedTokenRepository } from './revoked-token.repository.js';

/**
 * Revogação global de sessões (#119): grava o instante da revogação e, só
 * depois de gravar, avisa o barramento (que fecha os sockets do usuário).
 * Um token é "da sessão revogada" quando foi emitido até o segundo da revogação.
 *
 * Ex.: `await sessoes.revogarTodas(userId)` na troca/reset de senha;
 * `await sessoes.estaRevogada(sub, iat)` no refresh e no handshake do WebSocket.
 */
export class SessaoRevogacaoService implements SessaoRevogador {
  constructor(
    private readonly tokensRevogados: RevokedTokenRepository,
    private readonly lifecycle: SessaoLifecyclePublisher,
  ) {}

  async revogarTodas(userId: string): Promise<void> {
    await this.tokensRevogados.revokeAllByUserId(userId);
    // Só depois do commit: falha antes dele nunca fecha sockets.
    this.lifecycle.sessoesRevogadas(userId);
  }

  /**
   * `emitidoEmSegundos` é o claim `iat` (segundos). A comparação é `<=` no
   * segundo: um token emitido no mesmo segundo da revogação pode ter nascido
   * antes dela e não dá para distinguir — prefere-se a falha fechada. Token sem
   * `iat` com revogação global registrada também é tratado como revogado.
   */
  async estaRevogada(userId: string, emitidoEmSegundos: number | undefined): Promise<boolean> {
    const revogadoEm = await this.tokensRevogados.findRevokedAllAt(userId);
    if (!revogadoEm) return false;
    if (emitidoEmSegundos === undefined) return true;
    return emitidoEmSegundos <= Math.floor(revogadoEm.getTime() / 1000);
  }
}
