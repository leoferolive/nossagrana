import { buildApp } from '../../../app.js';
import type { InMemoryFamiliaRepository } from '../../../modules/familia/familia.repository.js';
import type { AcessoFamilia } from '../familia-access.repository.js';
import type { VerificadorAcessoFamilia } from '../verificador-acesso-familia.js';

/**
 * Verificador de testes de integração de rota: a posse vem do MESMO repositório
 * InMemory de famílias que as rotas `/familias` gravam, então só é membro quem
 * criou ou entrou na família pela API (#79). `obterRepositorio` é lazy porque o
 * verificador nasce antes da app que detém os repositórios compartilhados.
 */
export class VerificadorAcessoFamiliaInMemory implements VerificadorAcessoFamilia {
  constructor(private readonly obterRepositorio: () => InMemoryFamiliaRepository) {}

  async verificar(usuarioId: string, familiaId: string): Promise<AcessoFamilia> {
    const membro = await this.obterRepositorio().hasMembership({ familiaId, usuarioId });
    return membro ? 'ativa' : 'sem_acesso';
  }
}

/** `buildApp` com posse real (InMemory), para suítes que criam famílias pela própria API. */
export function buildAppComFamiliasInMemory(): ReturnType<typeof buildApp> {
  const repositorio = (): InMemoryFamiliaRepository => {
    const repositorios = app.repositoriosInMemory;
    if (!repositorios) throw new Error('repositoriosInMemory ausente: NODE_ENV deveria ser test');
    return repositorios.familias;
  };
  const app = buildApp({
    verificadorAcessoFamilia: new VerificadorAcessoFamiliaInMemory(repositorio),
  });
  return app;
}
