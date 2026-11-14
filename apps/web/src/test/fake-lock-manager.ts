import type { LockManagerLike } from '../services/refresh-lock';

/** Fake de `navigator.locks`: exclusão mútua FIFO por execução, registrando os nomes pedidos. */
export class FakeLockManager implements LockManagerLike {
  nomes: string[] = [];
  private fila: Promise<unknown> = Promise.resolve();

  request<T>(name: string, callback: () => Promise<T>): Promise<T> {
    this.nomes.push(name);
    const execucao = this.fila.then(callback);
    this.fila = execucao.catch(() => undefined);
    return execucao;
  }

  /** Simula outra aba segurando o lock até `liberar()`. */
  segurar(): () => void {
    let liberar!: () => void;
    const aberto = new Promise<void>((resolve) => (liberar = resolve));
    void this.request('nossagrana-refresh', () => aberto);
    return liberar;
  }
}
