import { describe, expect, it } from 'vitest';

import { FakeLockManager } from '../test/fake-lock-manager';

import { comLockDeRefresh } from './refresh-lock';

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
