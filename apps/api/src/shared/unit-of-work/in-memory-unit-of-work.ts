import { EscopoTransacional, isolarUnidade } from './escopo-transacional.js';
import type {
  ContextoUnidadeDeTrabalho,
  ParticipanteInMemory,
  UnitOfWork,
} from './unit-of-work.types.js';

type Participantes<R> = { readonly [K in keyof R]: ParticipanteInMemory<R[K]> };

interface EstatisticasUnidadeDeTrabalho {
  iniciadas: number;
  confirmadas: number;
  desfeitas: number;
}

/**
 * Fake nomeada da Unit of Work para testes e NODE_ENV=test: cada execução
 * trabalha sobre cópias (staging) dos repositórios InMemory; só o commit
 * publica as cópias, e uma exceção as descarta — assim os testes provam
 * ausência de escrita parcial de verdade, não só que "um método foi chamado".
 *
 * Invariantes (limitações conscientes, suficientes para vitest sequencial):
 * - o staging é cópia RASA: fakes participantes precisam substituir objetos
 *   ao alterar (`{ ...t, campo }`), nunca mutar no lugar — senão a mutação
 *   vaza para a base antes do commit e sobrevive ao rollback;
 * - `publicar` substitui o conjunto inteiro: escritas feitas direto na base
 *   (fora da UoW) enquanto uma unidade está aberta são perdidas no commit, e
 *   execuções concorrentes não são serializadas (a última a publicar vence).
 */
export class InMemoryUnitOfWork<R extends Record<string, object>> implements UnitOfWork<R> {
  private readonly contagem: EstatisticasUnidadeDeTrabalho = {
    iniciadas: 0,
    confirmadas: 0,
    desfeitas: 0,
  };

  constructor(private readonly participantes: Participantes<R>) {}

  async executar<T>(trabalho: (contexto: ContextoUnidadeDeTrabalho<R>) => Promise<T>): Promise<T> {
    const [resultado, escopo] = await isolarUnidade(() => this.rodarEPublicar(trabalho));
    // Fora da unidade: o staging já foi publicado (equivalente ao COMMIT).
    await escopo.executarEfeitos();
    return resultado;
  }

  private async rodarEPublicar<T>(
    trabalho: (contexto: ContextoUnidadeDeTrabalho<R>) => Promise<T>,
  ): Promise<readonly [T, EscopoTransacional<R>]> {
    this.contagem.iniciadas++;
    const stagings = this.abrirStagings();
    const escopo = new EscopoTransacional(stagings);
    const resultado = await escopo.rodar(trabalho).catch((erro: unknown) => {
      this.contagem.desfeitas++;
      throw erro;
    });
    this.publicar(stagings);
    this.contagem.confirmadas++;
    return [resultado, escopo] as const;
  }

  estatisticas(): EstatisticasUnidadeDeTrabalho {
    return { ...this.contagem };
  }

  private abrirStagings(): R {
    const entradas = this.nomes().map((nome) => [nome, this.participantes[nome].abrirStaging()]);
    return Object.fromEntries(entradas) as R;
  }

  private publicar(stagings: R): void {
    for (const nome of this.nomes()) this.participantes[nome].publicar(stagings[nome]);
  }

  private nomes(): (keyof R & string)[] {
    return Object.keys(this.participantes) as (keyof R & string)[];
  }
}
