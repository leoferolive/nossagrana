import { InMemoryIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';
import type {
  ContextoUnidadeDeTrabalho,
  UnitOfWork,
} from '../../shared/unit-of-work/unit-of-work.types.js';
import { InMemoryTransacaoRepository } from '../transacao/transacao.repository.js';
import type { TransacaoRepository } from '../transacao/transacao.types.js';
import { InMemoryCofrinhoRepository } from './cofrinho.in-memory-repository.js';
import { InMemoryMovimentacaoCofrinhoRepository } from './cofrinho.movimentacao.repository.js';
import { CofrinhoService } from './cofrinho.service.js';
import type {
  CofrinhoRepositorios,
  TransacaoRecorrenteCreator,
  TransacaoRecorrenteInput,
} from './cofrinho.types.js';
import { criarUnitOfWorkCofrinhoInMemory } from './cofrinho.unit-of-work.js';

/** Ponto de escrita `<repositório>.<método>` onde a falha é injetada. */
export type PontoDeFalha = {
  [K in keyof CofrinhoRepositorios]: `${K}.${Extract<keyof CofrinhoRepositorios[K], string>}`;
}[keyof CofrinhoRepositorios];

/** Falha simulada: lançada DEPOIS que a escrita do ponto já aconteceu. */
export class FalhaInjetadaError extends Error {
  constructor(ponto: string) {
    super(`Falha injetada após ${ponto}`);
    this.name = 'FalhaInjetadaError';
  }
}

type Metodo = (...args: unknown[]) => Promise<unknown>;

/**
 * Barreira de teste: quem chega em `alcancar()` fica parado (segurando o que
 * já travou, ex.: o lock da linha) até o teste chamar `liberar()`.
 */
export class BarreiraDeTeste {
  private sinalizarChegada: () => void = () => undefined;
  private abrir: () => void = () => undefined;
  readonly alcancada = new Promise<void>((resolve) => (this.sinalizarChegada = resolve));
  private readonly aberta = new Promise<void>((resolve) => (this.abrir = resolve));

  alcancar(): Promise<void> {
    this.sinalizarChegada();
    return this.aberta;
  }

  liberar(): void {
    this.abrir();
  }
}

/**
 * Fake nomeada: decora qualquer Unit of Work (InMemory ou Drizzle real),
 * anota cada chamada de repositório (`chamadas`) e, se configurada, lança
 * `FalhaInjetadaError` logo APÓS o método `ponto` concluir — prova que a
 * escrita já feita é desfeita pelo rollback, não apenas "não executada".
 */
export class UnitOfWorkInstrumentada implements UnitOfWork<CofrinhoRepositorios> {
  readonly chamadas: string[] = [];
  private ponto: PontoDeFalha | null = null;
  private falharNaChamada: number | null = null;
  private pausa: { ponto: PontoDeFalha; barreira: BarreiraDeTeste } | null = null;

  constructor(private readonly interna: UnitOfWork<CofrinhoRepositorios>) {}

  falharApos(ponto: PontoDeFalha): void {
    this.ponto = ponto;
  }

  /** Falha logo APÓS a N-ésima chamada de repositório (1 = a primeira), contando desde já. */
  falharAposChamada(n: number): void {
    this.chamadas.length = 0;
    this.falharNaChamada = n;
  }

  /** Para a unidade logo após `ponto` (ainda dentro da transação) até a barreira ser liberada. */
  pausarApos(ponto: PontoDeFalha, barreira: BarreiraDeTeste): void {
    this.pausa = { ponto, barreira };
  }

  executar<T>(
    trabalho: (contexto: ContextoUnidadeDeTrabalho<CofrinhoRepositorios>) => Promise<T>,
  ): Promise<T> {
    return this.interna.executar((contexto) =>
      trabalho({ ...contexto, repos: this.instrumentar(contexto.repos) }),
    );
  }

  private instrumentar(repos: CofrinhoRepositorios): CofrinhoRepositorios {
    return {
      cofrinhos: this.espiar('cofrinhos', repos.cofrinhos),
      movimentacoes: this.espiar('movimentacoes', repos.movimentacoes),
      transacoes: this.espiar('transacoes', repos.transacoes),
      idempotencia: this.espiar('idempotencia', repos.idempotencia),
    };
  }

  private espiar<T extends object>(nome: string, repo: T): T {
    return new Proxy(repo, {
      get: (alvo, prop) => {
        const valor: unknown = Reflect.get(alvo, prop);
        if (typeof valor !== 'function') return valor;
        return (...args: unknown[]) => this.chamar(`${nome}.${String(prop)}`, alvo, valor, args);
      },
    });
  }

  private async chamar(chamada: string, alvo: object, metodo: unknown, args: unknown[]) {
    this.chamadas.push(chamada);
    const resultado = await (metodo as Metodo).apply(alvo, args);
    if (chamada === this.pausa?.ponto) await this.pausa.barreira.alcancar();
    if (chamada === this.ponto) throw new FalhaInjetadaError(chamada);
    if (this.chamadas.length === this.falharNaChamada) throw new FalhaInjetadaError(chamada);
    return resultado;
  }
}

/**
 * Fake nomeada da porta de aporte recorrente: grava o pai recorrente pelo
 * repositório de transação RECEBIDO (o do tx) e anota o que foi pedido.
 */
export class TransacaoRecorrenteCreatorFake implements TransacaoRecorrenteCreator {
  readonly criadas: TransacaoRecorrenteInput[] = [];
  readonly canceladas: Array<{ transacaoPaiId: string; familiaId: string }> = [];

  async criarRecorrente(input: TransacaoRecorrenteInput, transacoes: TransacaoRepository) {
    this.criadas.push(input);
    const { frequencia, dataFimRecorrencia, ...lancamento } = input;
    return transacoes.create({ ...lancamento, recorrente: true, frequencia, dataFimRecorrencia });
  }

  async cancelarRecorrencia(input: { transacaoPaiId: string; familiaId: string }) {
    this.canceladas.push(input);
  }
}

export const CATEGORIA_COFRINHO_FAKE = 'cat-cofrinho-id';

export interface RepositoriosCofrinhoInMemory {
  cofrinhos: InMemoryCofrinhoRepository;
  movimentacoes: InMemoryMovimentacaoCofrinhoRepository;
  transacoes: InMemoryTransacaoRepository;
  idempotencia: InMemoryIdempotenciaRepository;
  uow: ReturnType<typeof criarUnitOfWorkCofrinhoInMemory>;
  instrumentada: UnitOfWorkInstrumentada;
  buscarCategoriaCofrinho: () => Promise<{ id: string }>;
}

/** Repositórios InMemory do cofrinho + InMemoryUnitOfWork instrumentada (cofrinho e templates). */
export function montarRepositoriosCofrinhoInMemory(): RepositoriosCofrinhoInMemory {
  const repos = {
    cofrinhos: new InMemoryCofrinhoRepository(),
    movimentacoes: new InMemoryMovimentacaoCofrinhoRepository(),
    transacoes: new InMemoryTransacaoRepository(),
    idempotencia: new InMemoryIdempotenciaRepository(),
  };
  const uow = criarUnitOfWorkCofrinhoInMemory(repos);
  const instrumentada = new UnitOfWorkInstrumentada(uow);
  const buscarCategoriaCofrinho = async () => ({ id: CATEGORIA_COFRINHO_FAKE });
  return { ...repos, uow, instrumentada, buscarCategoriaCofrinho };
}

export interface CofrinhoServiceInMemory extends RepositoriosCofrinhoInMemory {
  service: CofrinhoService;
}

/** CofrinhoService completo sobre repositórios InMemory e InMemoryUnitOfWork instrumentada. */
export function montarCofrinhoServiceInMemory(
  opcoes: { recorrente?: TransacaoRecorrenteCreator } = {},
): CofrinhoServiceInMemory {
  const ambiente = montarRepositoriosCofrinhoInMemory();
  const service = new CofrinhoService(
    ambiente,
    ambiente.instrumentada,
    ambiente.buscarCategoriaCofrinho,
    opcoes.recorrente,
  );
  return { ...ambiente, service };
}
