import { IdempotenciaConflitoError } from './idempotencia.errors.js';
import type {
  IdempotenciaRepository,
  OpcoesIdempotencia,
  PedidoIdempotente,
  RegistroIdempotencia,
  RespostaGravada,
  ResultadoIdempotente,
} from './idempotencia.types.js';

/**
 * Roda `operacao` com deduplicação por `Idempotency-Key`. Deve ser chamado
 * DENTRO da Unit of Work da operação, com o repositório do mesmo tx: a reserva
 * é a 1ª escrita da unidade, e a resposta é gravada antes do commit — rollback
 * apaga a chave, então um retry depois de uma falha executa de novo.
 *
 * Sem opções (sem header): executa sempre, sem deduplicação (contrato anterior).
 *
 * @example
 * uow.executar(({ repos }) =>
 *   executarComIdempotencia(repos.idempotencia, opcoes, () => gravarPlano(repos, plano)));
 */
export async function executarComIdempotencia<T>(
  idempotencia: IdempotenciaRepository,
  opcoes: OpcoesIdempotencia<T> | null,
  operacao: () => Promise<T>,
): Promise<ResultadoIdempotente<T>> {
  if (!opcoes) return { tipo: 'executada', valor: await operacao() };
  const { pedido } = opcoes;
  const reserva = await idempotencia.reservar(pedido);
  if (!reserva.reservada) {
    return { tipo: 'repetida', resposta: respostaDoReplay(pedido, reserva.existente) };
  }
  const valor = await operacao();
  const resposta = exigirSucesso(opcoes.responder(valor), pedido);
  await idempotencia.gravarResposta({ familiaId: pedido.familiaId, chave: pedido.chave, resposta });
  return { tipo: 'executada', valor };
}

/** Mesma chave só repete a MESMA requisição (operação + hash do payload). */
function respostaDoReplay(
  pedido: PedidoIdempotente,
  existente: RegistroIdempotencia,
): RespostaGravada {
  const mesmaRequisicao =
    existente.operacao === pedido.operacao && existente.hashPayload === pedido.hashPayload;
  if (!mesmaRequisicao) {
    throw new IdempotenciaConflitoError(pedido.chave, existente.operacao, pedido.operacao);
  }
  if (!existente.resposta) {
    // Após o commit a resposta sempre existe (CHECK na tabela); chegar aqui é bug.
    throw new Error(
      `Chave de idempotência "${pedido.chave}" da família ${pedido.familiaId} sem resposta ` +
        'gravada: esperado status 2xx + corpo confirmados junto com a operação',
    );
  }
  return existente.resposta;
}

/** Só sucesso é gravado: erro de negócio/validação sai por exceção e desfaz tudo. */
function exigirSucesso(resposta: RespostaGravada, pedido: PedidoIdempotente): RespostaGravada {
  if (resposta.statusCode >= 200 && resposta.statusCode < 300) return resposta;
  throw new Error(
    `Resposta idempotente de ${pedido.operacao}: status ${resposta.statusCode} recebido, ` +
      'esperado 2xx (erros não são gravados, saem por exceção)',
  );
}
