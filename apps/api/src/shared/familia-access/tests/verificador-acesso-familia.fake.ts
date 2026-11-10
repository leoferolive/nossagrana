import type { AcessoFamilia } from '../familia-access.repository.js';
import type { VerificadorAcessoFamilia } from '../verificador-acesso-familia.js';

/**
 * Fake nomeada do verificador de posse: só quem foi explicitamente vinculado
 * (`vincular`) tem acesso; qualquer outro par usuário/família é `sem_acesso`.
 * `falharCom` simula indisponibilidade do verificador (deve virar recusa, não 200).
 */
export class VerificadorAcessoFamiliaFake implements VerificadorAcessoFamilia {
  private readonly vinculos = new Map<string, AcessoFamilia>();
  private erro: Error | null = null;

  vincular(usuarioId: string, familiaId: string, acesso: AcessoFamilia = 'ativa'): this {
    this.vinculos.set(`${usuarioId}:${familiaId}`, acesso);
    return this;
  }

  falharCom(erro: Error): this {
    this.erro = erro;
    return this;
  }

  async verificar(usuarioId: string, familiaId: string): Promise<AcessoFamilia> {
    if (this.erro) throw this.erro;
    return this.vinculos.get(`${usuarioId}:${familiaId}`) ?? 'sem_acesso';
  }
}

/** `sub` do access token JWT, para vincular o usuário recém-logado na fake. */
export function subDoAccessToken(accessToken: string): string {
  const payload = accessToken.split('.')[1] ?? '';
  const { sub } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string };
  return sub;
}
