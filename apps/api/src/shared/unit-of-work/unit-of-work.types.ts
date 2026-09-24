/**
 * Unit of Work (issue #78): operações financeiras compostas (pai + filhas +
 * efeitos derivados) rodam num único commit/rollback. O service recebe a
 * abstração injetada e nunca importa o singleton `db`.
 */

/** Efeito que só pode acontecer depois do commit (ex.: publicar evento). */
export type EfeitoPosCommit = () => void | Promise<void>;

/** O que o trabalho recebe: repositórios ligados à transação e o registro de efeitos. */
export interface ContextoUnidadeDeTrabalho<R> {
  repos: R;
  aoConfirmar(efeito: EfeitoPosCommit): void;
}

/**
 * Executa `trabalho` numa transação: resolve só depois do commit; se o
 * trabalho rejeitar, faz rollback e propaga o erro original.
 *
 * @example
 * const pai = await uow.executar(async ({ repos, aoConfirmar }) => {
 *   const criado = await repos.transacoes.create(input);
 *   aoConfirmar(() => eventos.emit('transacao:alterada', { familiaId }));
 *   return criado;
 * });
 */
export interface UnitOfWork<R> {
  executar<T>(trabalho: (contexto: ContextoUnidadeDeTrabalho<R>) => Promise<T>): Promise<T>;
}

/**
 * Repositório InMemory que participa de uma `InMemoryUnitOfWork`: sabe abrir
 * uma cópia isolada (staging) e publicá-la de volta no commit. Declarado com
 * sintaxe de método para aceitar staging de subtipo (bivariância).
 *
 * Contrato: `abrirStaging` pode ser cópia rasa, desde que o repositório
 * substitua objetos ao alterar (nunca mute no lugar); `publicar` substitui o
 * conjunto inteiro da base pelo do staging.
 */
export interface ParticipanteInMemory<T> {
  abrirStaging(): T;
  publicar(staging: T): void;
}
