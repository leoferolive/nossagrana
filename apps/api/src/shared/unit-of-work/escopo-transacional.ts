import { AsyncLocalStorage } from 'node:async_hooks';

import type { ContextoUnidadeDeTrabalho, EfeitoPosCommit } from './unit-of-work.types.js';

/** Uso de repositório/`aoConfirmar` capturado depois do commit ou rollback. */
export class UnidadeDeTrabalhoEncerradaError extends Error {
  constructor(chamada: string) {
    super(
      `Unidade de trabalho já encerrada: chamada "${chamada}" recebida após commit/rollback; ` +
        'esperado usar repositórios e aoConfirmar só dentro do callback de executar()',
    );
    this.name = 'UnidadeDeTrabalhoEncerradaError';
  }
}

/**
 * `executar()` chamado dentro de outra unidade ainda aberta. No Drizzle isso
 * abriria uma 2ª transação em OUTRA conexão, fora do commit externo — e pode
 * travar (ex. #59: externa com `SELECT ... FOR UPDATE` no cofrinho, interna
 * inserindo transação cuja FK composta precisa de `FOR KEY SHARE` nele).
 */
export class UnidadeDeTrabalhoAninhadaError extends Error {
  constructor() {
    super(
      'Unidade de trabalho aninhada: executar() chamado com outra unidade ainda aberta na mesma ' +
        'cadeia async; esperado usar os repositórios do contexto externo (savepoints não são suportados)',
    );
    this.name = 'UnidadeDeTrabalhoAninhadaError';
  }
}

/** Efeito pós-commit falhou: os dados JÁ estão gravados, não houve rollback. */
export class EfeitoPosCommitError extends Error {
  constructor(causa: unknown) {
    const detalhe = causa instanceof Error ? causa.message : String(causa);
    super(`Efeito pós-commit falhou com a unidade de trabalho já confirmada: ${detalhe}`, {
      cause: causa,
    });
    this.name = 'EfeitoPosCommitError';
  }
}

type Metodo = (...args: unknown[]) => unknown;

interface MarcaUnidade {
  ativa: boolean;
}

/** Global de propósito: aninhar unidades DIFERENTES sobre o mesmo pool também é proibido. */
const unidadeCorrente = new AsyncLocalStorage<MarcaUnidade>();

/**
 * Roda `abrir` marcando a cadeia async como "dentro de uma unidade" e recusa
 * aninhamento. A marca é desligada no fim, então continuações vazadas e
 * efeitos pós-commit (que rodam depois) podem abrir unidades novas.
 */
export async function isolarUnidade<T>(abrir: () => Promise<T>): Promise<T> {
  if (unidadeCorrente.getStore()?.ativa) throw new UnidadeDeTrabalhoAninhadaError();
  const marca: MarcaUnidade = { ativa: true };
  try {
    return await unidadeCorrente.run(marca, abrir);
  } finally {
    marca.ativa = false;
  }
}

/**
 * Proxy que bloqueia métodos do repositório fora da unidade: um `tx` do
 * Drizzle reutilizado após o commit falharia de forma obscura (ou gravaria
 * fora da transação); aqui falha na hora, com o nome da chamada. Todo método
 * de repositório é async por contrato, então a guarda devolve promise
 * rejeitada (um throw síncrono escaparia de `repo.metodo().catch(...)`).
 */
function protegerRepositorio<T extends object>(nome: string, repo: T, ativo: () => boolean): T {
  return new Proxy(repo, {
    get(alvo, prop) {
      const valor: unknown = Reflect.get(alvo, prop);
      if (typeof valor !== 'function') return valor;
      return (...args: unknown[]) => {
        if (!ativo()) {
          return Promise.reject(new UnidadeDeTrabalhoEncerradaError(`${nome}.${String(prop)}`));
        }
        return (valor as Metodo).apply(alvo, args);
      };
    },
  });
}

function protegerRepositorios<R extends Record<string, object>>(repos: R, ativo: () => boolean): R {
  const entradas = Object.entries(repos).map(([nome, repo]) => [
    nome,
    protegerRepositorio(nome, repo, ativo),
  ]);
  return Object.fromEntries(entradas) as R;
}

/**
 * Estado de UMA execução de unidade de trabalho, comum aos adapters: entrega
 * repositórios protegidos, acumula efeitos pós-commit e encerra o escopo
 * quando o trabalho termina (com sucesso ou erro).
 */
export class EscopoTransacional<R extends Record<string, object>> {
  private ativo = true;
  private readonly efeitos: EfeitoPosCommit[] = [];
  private readonly contexto: ContextoUnidadeDeTrabalho<R>;

  constructor(repos: R) {
    this.contexto = {
      repos: protegerRepositorios(repos, () => this.ativo),
      aoConfirmar: (efeito) => this.registrarEfeito(efeito),
    };
  }

  async rodar<T>(trabalho: (contexto: ContextoUnidadeDeTrabalho<R>) => Promise<T>): Promise<T> {
    try {
      return await trabalho(this.contexto);
    } finally {
      this.ativo = false;
    }
  }

  /** Só depois do commit. Sequencial: o primeiro efeito que falhar interrompe os demais. */
  async executarEfeitos(): Promise<void> {
    for (const efeito of this.efeitos) {
      await Promise.resolve()
        .then(efeito)
        .catch((causa: unknown) => {
          throw new EfeitoPosCommitError(causa);
        });
    }
  }

  private registrarEfeito(efeito: EfeitoPosCommit): void {
    if (!this.ativo) throw new UnidadeDeTrabalhoEncerradaError('aoConfirmar');
    this.efeitos.push(efeito);
  }
}
