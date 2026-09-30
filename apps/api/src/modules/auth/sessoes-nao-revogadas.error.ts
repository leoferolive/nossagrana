import type { FastifyBaseLogger } from 'fastify';

import type { SessaoRevogador } from './auth.types.js';

/**
 * A senha JÁ foi gravada, mas a revogação das sessões falhou (#119): as sessões antigas
 * seguem válidas e repetir a operação não adianta (a senha antiga passou a ser rejeitada).
 * Carrega o `userId` para a rota logar o estado inconsistente e acionar a operação.
 */
export class SessoesNaoRevogadasError extends Error {
  constructor(
    readonly userId: string,
    cause: unknown,
  ) {
    super(`Senha alterada, mas a revogação das sessões do usuário ${userId} falhou`, { cause });
    this.name = 'SessoesNaoRevogadasError';
  }
}

/** Revoga todas as sessões do usuário, convertendo qualquer falha em `SessoesNaoRevogadasError`. */
export async function revogarSessoesAposTrocaDeSenha(
  sessoes: SessaoRevogador,
  userId: string,
): Promise<void> {
  try {
    await sessoes.revogarTodas(userId);
  } catch (error) {
    throw new SessoesNaoRevogadasError(userId, error);
  }
}

/** Loga o estado inconsistente (senha trocada, sessões vivas) com o `userId`; ignora outros erros. */
export function logarSessoesNaoRevogadas(log: FastifyBaseLogger, error: unknown): void {
  if (!(error instanceof SessoesNaoRevogadasError)) return;
  log.error(
    { userId: error.userId, err: error.cause },
    'Senha alterada mas sessões não revogadas: sessões antigas seguem válidas até expirar',
  );
}
