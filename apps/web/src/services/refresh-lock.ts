/** Subconjunto de `navigator.locks` usado aqui (permite uma fake nomeada nos testes). */
export interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

const NOME_DO_LOCK = 'nossagrana-refresh';

const locksDoNavegador = (): LockManagerLike | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as { locks?: LockManagerLike }).locks;

/**
 * Serializa o refresh entre abas: o single-flight do `ApiClient` é por instância, e duas abas
 * rotacionando o mesmo cookie ao mesmo tempo disparariam a detecção de reuso (#117, #153).
 * Quem espera o lock usa o cookie já rotacionado pela outra aba. Sem `navigator.locks`
 * (jsdom, navegadores antigos) executa direto.
 */
export const comLockDeRefresh = <T>(
  tarefa: () => Promise<T>,
  locks: LockManagerLike | undefined = locksDoNavegador(),
): Promise<T> => (locks ? locks.request(NOME_DO_LOCK, tarefa) : tarefa());
