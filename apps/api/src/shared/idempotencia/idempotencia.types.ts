/**
 * Idempotência de operações financeiras (#90): o cliente manda
 * `Idempotency-Key`; a chave é reservada DENTRO da mesma Unit of Work da
 * operação, então commit/rollback valem para os dados e para a chave juntos.
 */

/** Identifica uma tentativa: chave do cliente + o que ela pretende executar. */
export interface PedidoIdempotente {
  familiaId: string;
  chave: string;
  /** Rota-template, ex.: `POST /api/cofrinhos/:id/aportes`. */
  operacao: string;
  /** sha256 do material canônico (usuário + params + corpo) — nunca o corpo em claro. */
  hashPayload: string;
}

/** Resposta HTTP de sucesso (2xx) devolvida de novo em cada replay. */
export interface RespostaGravada {
  statusCode: number;
  corpo: unknown;
}

/** Linha confirmada de uma chave: `resposta` só é `null` numa reserva ainda não concluída. */
export interface RegistroIdempotencia extends PedidoIdempotente {
  resposta: RespostaGravada | null;
  criadoEm: Date;
}

export type ResultadoReserva =
  | { reservada: true }
  | { reservada: false; existente: RegistroIdempotencia };

/**
 * Tabela `chaves_idempotencia`. `reservar` e `gravarResposta` rodam no tx da
 * operação; só `removerExpiradas` (job de manutenção) roda fora de uma unidade.
 */
export interface IdempotenciaRepository {
  /**
   * `INSERT ... ON CONFLICT (familia_id, chave)`: reserva a chave, ou devolve
   * o registro já confirmado. Uma chave expirada é reaproveitada como nova.
   */
  reservar(pedido: PedidoIdempotente): Promise<ResultadoReserva>;
  gravarResposta(input: {
    familiaId: string;
    chave: string;
    resposta: RespostaGravada;
  }): Promise<void>;
  /** Apaga chaves fora da janela de replay; devolve quantas removeu. */
  removerExpiradas(): Promise<number>;
}

/** Passado pela rota: o pedido e como transformar o resultado na resposta HTTP gravada. */
export interface OpcoesIdempotencia<T> {
  pedido: PedidoIdempotente;
  responder(valor: T): RespostaGravada;
}

/** `executada`: a operação rodou agora. `repetida`: replay da resposta gravada, nada executado. */
export type ResultadoIdempotente<T> =
  | { tipo: 'executada'; valor: T }
  | { tipo: 'repetida'; resposta: RespostaGravada };
