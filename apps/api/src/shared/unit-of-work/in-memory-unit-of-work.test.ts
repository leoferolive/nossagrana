import { describe, expect, it } from 'vitest';

import { InMemoryUnitOfWork } from './in-memory-unit-of-work.js';
import type { ParticipanteInMemory } from './unit-of-work.types.js';
import {
  UnidadeDeTrabalhoAninhadaError,
  UnidadeDeTrabalhoEncerradaError,
} from './escopo-transacional.js';

/** Fake nomeada: coleção InMemory mínima que sabe abrir staging e publicá-lo. */
class ColecaoInMemoryFake implements ParticipanteInMemory<ColecaoInMemoryFake> {
  constructor(private itens: string[] = []) {}

  async adicionar(item: string): Promise<void> {
    this.itens.push(item);
  }

  listar(): string[] {
    return [...this.itens];
  }

  abrirStaging(): ColecaoInMemoryFake {
    return new ColecaoInMemoryFake([...this.itens]);
  }

  publicar(staging: ColecaoInMemoryFake): void {
    this.itens = staging.listar();
  }
}

function setup() {
  const colecao = new ColecaoInMemoryFake();
  const uow = new InMemoryUnitOfWork({ colecao });
  return { colecao, uow };
}

describe('InMemoryUnitOfWork', () => {
  it('commit publica todas as escritas e devolve o resultado do trabalho', async () => {
    const { colecao, uow } = setup();

    const resultado = await uow.executar(async ({ repos }) => {
      await repos.colecao.adicionar('a');
      await repos.colecao.adicionar('b');
      return 'ok';
    });

    expect(resultado).toBe('ok');
    expect(colecao.listar()).toEqual(['a', 'b']);
    expect(uow.estatisticas()).toEqual({ iniciadas: 1, confirmadas: 1, desfeitas: 0 });
  });

  it('escritas ficam invisíveis fora da unidade até o commit', async () => {
    const { colecao, uow } = setup();

    await uow.executar(async ({ repos }) => {
      await repos.colecao.adicionar('a');
      expect(colecao.listar()).toEqual([]);
    });

    expect(colecao.listar()).toEqual(['a']);
  });

  it('exceção desfaz tudo (sem escrita parcial) e propaga o erro original', async () => {
    const { colecao, uow } = setup();
    const falha = new Error('falhou na 2ª escrita');

    await expect(
      uow.executar(async ({ repos }) => {
        await repos.colecao.adicionar('a');
        throw falha;
      }),
    ).rejects.toBe(falha);

    expect(colecao.listar()).toEqual([]);
    expect(uow.estatisticas()).toEqual({ iniciadas: 1, confirmadas: 0, desfeitas: 1 });
  });

  it('efeitos pós-commit rodam só depois de publicar, na ordem de registro', async () => {
    const { colecao, uow } = setup();
    const vistos: string[][] = [];

    await uow.executar(async ({ repos, aoConfirmar }) => {
      aoConfirmar(() => {
        vistos.push(colecao.listar());
      });
      aoConfirmar(async () => {
        vistos.push(['segundo']);
      });
      await repos.colecao.adicionar('a');
      expect(vistos).toEqual([]);
    });

    expect(vistos).toEqual([['a'], ['segundo']]);
  });

  it('efeitos pós-commit não rodam em rollback', async () => {
    const { uow } = setup();
    let executou = false;

    await expect(
      uow.executar(async ({ aoConfirmar }) => {
        aoConfirmar(() => {
          executou = true;
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    expect(executou).toBe(false);
  });

  it('usar o repositório transacional depois do fim falha de forma clara', async () => {
    const { colecao, uow } = setup();
    let capturado: ColecaoInMemoryFake | undefined;

    await uow.executar(async ({ repos }) => {
      capturado = repos.colecao;
    });

    await expect(capturado?.adicionar('tarde')).rejects.toThrow(UnidadeDeTrabalhoEncerradaError);
    expect(colecao.listar()).toEqual([]);
  });

  it('guarda devolve promise rejeitada: `.catch` encadeado sem await captura o erro', async () => {
    const { uow } = setup();
    let capturado: ColecaoInMemoryFake | undefined;
    await uow.executar(async ({ repos }) => {
      capturado = repos.colecao;
    });

    const erro = await capturado?.adicionar('tarde').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(UnidadeDeTrabalhoEncerradaError);
  });

  it('executar aninhado (mesma ou outra unidade) falha com erro nomeado e desfaz a externa', async () => {
    const { colecao, uow } = setup();
    const outra = new InMemoryUnitOfWork({ colecao });

    for (const interna of [uow, outra]) {
      await expect(
        uow.executar(async ({ repos }) => {
          await repos.colecao.adicionar('externa');
          await interna.executar(async ({ repos: r }) => r.colecao.adicionar('interna'));
        }),
      ).rejects.toThrow(UnidadeDeTrabalhoAninhadaError);
    }

    expect(colecao.listar()).toEqual([]);
    expect(outra.estatisticas().iniciadas).toBe(0);
  });

  it('efeito pós-commit pode abrir nova unidade (já está fora da anterior)', async () => {
    const { colecao, uow } = setup();
    let posCommit: Promise<void> | undefined;

    await uow.executar(async ({ repos, aoConfirmar }) => {
      await repos.colecao.adicionar('a');
      aoConfirmar(() => {
        posCommit = uow.executar(async ({ repos: r }) => r.colecao.adicionar('b'));
      });
    });
    await posCommit;

    expect(colecao.listar()).toEqual(['a', 'b']);
  });

  it('registrar efeito depois do fim também falha de forma clara', async () => {
    const { uow } = setup();
    let registrarTarde: ((efeito: () => void) => void) | undefined;

    await uow.executar(async ({ aoConfirmar }) => {
      registrarTarde = aoConfirmar;
    });

    expect(() => registrarTarde?.(() => undefined)).toThrow(UnidadeDeTrabalhoEncerradaError);
  });

  it('cada execução é uma unidade independente', async () => {
    const { colecao, uow } = setup();

    await uow.executar(async ({ repos }) => repos.colecao.adicionar('a'));
    await expect(
      uow.executar(async ({ repos }) => {
        await repos.colecao.adicionar('b');
        throw new Error('só a segunda desfaz');
      }),
    ).rejects.toThrow();

    expect(colecao.listar()).toEqual(['a']);
    expect(uow.estatisticas()).toEqual({ iniciadas: 2, confirmadas: 1, desfeitas: 1 });
  });
});
