import { describe, expect, it } from 'vitest';

import { DrizzleUnitOfWork } from './drizzle-unit-of-work.js';
import {
  EfeitoPosCommitError,
  UnidadeDeTrabalhoAninhadaError,
  UnidadeDeTrabalhoEncerradaError,
} from './escopo-transacional.js';

/** Handle de transação falso: só identifica em qual transação o repositório foi criado. */
interface TxFake {
  id: number;
}

/**
 * Fake nomeada do `db.transaction` do Drizzle: conta begin/commit/rollback e,
 * como o Drizzle, faz rollback quando o callback rejeita e repassa o erro.
 */
class BancoTransacionalFake {
  readonly eventos: string[] = [];
  private proximoId = 1;

  async transaction<T>(trabalho: (tx: TxFake) => Promise<T>): Promise<T> {
    const tx = { id: this.proximoId++ };
    this.eventos.push(`begin:${tx.id}`);
    try {
      const resultado = await trabalho(tx);
      this.eventos.push(`commit:${tx.id}`);
      return resultado;
    } catch (erro) {
      this.eventos.push(`rollback:${tx.id}`);
      throw erro;
    }
  }
}

/** Repositório falso ligado a um `tx`: registra as escritas no log do banco. */
class RepositorioLigadoATxFake {
  constructor(
    private readonly tx: TxFake,
    private readonly banco: BancoTransacionalFake,
  ) {}

  async gravar(valor: string): Promise<void> {
    this.banco.eventos.push(`write:${this.tx.id}:${valor}`);
  }
}

function setup() {
  const banco = new BancoTransacionalFake();
  const uow = new DrizzleUnitOfWork(banco, (tx: TxFake) => ({
    registros: new RepositorioLigadoATxFake(tx, banco),
  }));
  return { banco, uow };
}

describe('DrizzleUnitOfWork', () => {
  it('abre e confirma a transação exatamente uma vez, com repositórios ligados ao tx', async () => {
    const { banco, uow } = setup();

    const resultado = await uow.executar(async ({ repos }) => {
      await repos.registros.gravar('pai');
      await repos.registros.gravar('filha');
      return 42;
    });

    expect(resultado).toBe(42);
    expect(banco.eventos).toEqual(['begin:1', 'write:1:pai', 'write:1:filha', 'commit:1']);
  });

  it('exceção no trabalho vira rollback único e o erro original é propagado', async () => {
    const { banco, uow } = setup();
    const falha = new Error('filha inválida');

    await expect(
      uow.executar(async ({ repos }) => {
        await repos.registros.gravar('pai');
        throw falha;
      }),
    ).rejects.toBe(falha);

    expect(banco.eventos).toEqual(['begin:1', 'write:1:pai', 'rollback:1']);
  });

  it('efeitos pós-commit rodam depois do commit e nunca em rollback', async () => {
    const { banco, uow } = setup();

    await uow.executar(async ({ aoConfirmar }) => {
      aoConfirmar(() => {
        banco.eventos.push('evento');
      });
    });
    await expect(
      uow.executar(async ({ aoConfirmar }) => {
        aoConfirmar(() => {
          banco.eventos.push('evento-indevido');
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(banco.eventos).toEqual(['begin:1', 'commit:1', 'evento', 'begin:2', 'rollback:2']);
  });

  it('falha de efeito pós-commit informa que os dados já foram confirmados', async () => {
    const { banco, uow } = setup();
    const causa = new Error('ws fora do ar');

    const erro = await uow
      .executar(async ({ aoConfirmar }) => {
        aoConfirmar(() => {
          throw causa;
        });
      })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(EfeitoPosCommitError);
    expect((erro as EfeitoPosCommitError).cause).toBe(causa);
    expect((erro as Error).message).toContain('já confirmada');
    expect(banco.eventos).toEqual(['begin:1', 'commit:1']);
  });

  it('repositório transacional usado depois do commit falha de forma clara', async () => {
    const { banco, uow } = setup();
    let capturado: RepositorioLigadoATxFake | undefined;

    await uow.executar(async ({ repos }) => {
      capturado = repos.registros;
    });

    await expect(capturado?.gravar('tarde')).rejects.toThrow(UnidadeDeTrabalhoEncerradaError);
    await expect(capturado?.gravar('tarde')).rejects.toThrow(/registros\.gravar/);
    expect(banco.eventos).toEqual(['begin:1', 'commit:1']);
  });

  it('repositório transacional usado depois do rollback também falha', async () => {
    const { uow } = setup();
    let capturado: RepositorioLigadoATxFake | undefined;

    await expect(
      uow.executar(async ({ repos }) => {
        capturado = repos.registros;
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    const erro = await capturado?.gravar('tarde').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(UnidadeDeTrabalhoEncerradaError);
  });

  it('executar aninhado não abre 2ª transação: lança erro nomeado e a externa faz rollback', async () => {
    const { banco, uow } = setup();

    await expect(
      uow.executar(async ({ repos }) => {
        await repos.registros.gravar('pai');
        await uow.executar(async ({ repos: internos }) => internos.registros.gravar('filha'));
      }),
    ).rejects.toThrow(UnidadeDeTrabalhoAninhadaError);

    expect(banco.eventos).toEqual(['begin:1', 'write:1:pai', 'rollback:1']);
  });

  it('continuação vazada após o fim da unidade não conta como aninhamento', async () => {
    const { banco, uow } = setup();
    let continuar: (() => Promise<void>) | undefined;

    await uow.executar(async () => {
      continuar = () => uow.executar(async ({ repos }) => repos.registros.gravar('depois'));
    });
    await continuar?.();

    expect(banco.eventos).toEqual(['begin:1', 'commit:1', 'begin:2', 'write:2:depois', 'commit:2']);
  });
});
