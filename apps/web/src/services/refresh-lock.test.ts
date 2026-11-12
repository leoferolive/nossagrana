import { describe, expect, it } from 'vitest';

import { comLockDeRefresh, type LockManagerLike } from './refresh-lock';

class FakeLockManager implements LockManagerLike {
  nomes: string[] = [];
  private fila: Promise<unknown> = Promise.resolve();

  request<T>(name: string, callback: () => Promise<T>): Promise<T> {
    this.nomes.push(name);
    const execucao = this.fila.then(callback);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }
}

describe('comLockDeRefresh (#117)', () => {
  it('serializa execuções sob o lock nossagrana-refresh', async () => {
    const locks = new FakeLockManager();
    const ordem: string[] = [];
    const tarefa = (id: string) => async () => {
      ordem.push(`${id}:inicio`);
      await Promise.resolve();
      ordem.push(`${id}:fim`);
      return id;
    };

    await Promise.all([comLockDeRefresh(tarefa('a'), locks), comLockDeRefresh(tarefa('b'), locks)]);

    expect(locks.nomes).toEqual(['nossagrana-refresh', 'nossagrana-refresh']);
    expect(ordem).toEqual(['a:inicio', 'a:fim', 'b:inicio', 'b:fim']);
  });

  it('sem navigator.locks (jsdom) executa direto', async () => {
    await expect(comLockDeRefresh(async () => 'ok', undefined)).resolves.toBe('ok');
  });
});
