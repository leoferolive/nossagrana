import { and, eq, lt, sql } from 'drizzle-orm';

import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { chavesIdempotencia } from '../../db/schema.js';
import type { ParticipanteInMemory } from '../unit-of-work/unit-of-work.types.js';
import type {
  IdempotenciaRepository,
  PedidoIdempotente,
  RegistroIdempotencia,
  RespostaGravada,
  ResultadoReserva,
} from './idempotencia.types.js';

const JANELA_REPLAY_HORAS = 24;
/** Replay só vale dentro desta janela; depois a chave pode ser reaproveitada e é limpa. */
export const JANELA_REPLAY_MS = JANELA_REPLAY_HORAS * 60 * 60 * 1000;

interface ChaveDaFamilia {
  familiaId: string;
  chave: string;
}

function descrever({ familiaId, chave }: ChaveDaFamilia): string {
  return `"${chave}" da família ${familiaId}`;
}

class ReservaAusenteError extends Error {
  constructor(alvo: ChaveDaFamilia) {
    super(
      `Resposta idempotente sem reserva para a chave ${descrever(alvo)}: ` +
        'esperado reservar a chave antes, na mesma unidade de trabalho',
    );
    this.name = 'ReservaAusenteError';
  }
}

/** Relógio do banco: expiração decidida por `now()` do PostgreSQL, não pelo relógio do pod. */
const limiteDaJanela = sql`now() - interval '${sql.raw(String(JANELA_REPLAY_HORAS))} hours'`;

const colunasRegistro = {
  familiaId: chavesIdempotencia.familiaId,
  chave: chavesIdempotencia.chave,
  operacao: chavesIdempotencia.operacao,
  hashPayload: chavesIdempotencia.hashPayload,
  statusCode: chavesIdempotencia.statusCode,
  resposta: chavesIdempotencia.resposta,
  criadoEm: chavesIdempotencia.criadoEm,
};

interface LinhaRegistro extends PedidoIdempotente {
  statusCode: number | null;
  resposta: unknown;
  criadoEm: Date;
}

function paraRegistro({ statusCode, resposta, ...linha }: LinhaRegistro): RegistroIdempotencia {
  const gravada = statusCode === null ? null : { statusCode, corpo: resposta };
  return { ...linha, resposta: gravada };
}

const daChave = ({ familiaId, chave }: ChaveDaFamilia) =>
  and(eq(chavesIdempotencia.familiaId, familiaId), eq(chavesIdempotencia.chave, chave));

/**
 * Adapter Drizzle, sempre sobre o `tx` da Unit of Work da operação. Toda
 * consulta filtra por `familia_id` — exceto `removerExpiradas`, manutenção
 * global do job de limpeza (como a de `revoked_refresh_tokens`).
 */
export class DrizzleIdempotenciaRepository implements IdempotenciaRepository {
  constructor(private readonly executor: ExecutorDrizzle) {}

  /**
   * Uma requisição concorrente com a mesma chave ESPERA no índice único até a
   * primeira confirmar (vê o registro → replay) ou desfazer (a reserva passa
   * a ser dela). `DO UPDATE ... WHERE expirada` (e não `DO NOTHING`) para uma
   * chave fora da janela, ainda não limpa, valer como nova.
   */
  async reservar(pedido: PedidoIdempotente): Promise<ResultadoReserva> {
    const reservadas = await this.executor
      .insert(chavesIdempotencia)
      .values(pedido)
      .onConflictDoUpdate({
        target: [chavesIdempotencia.familiaId, chavesIdempotencia.chave],
        set: {
          operacao: pedido.operacao,
          hashPayload: pedido.hashPayload,
          statusCode: null,
          resposta: null,
          criadoEm: sql`now()`,
        },
        setWhere: lt(chavesIdempotencia.criadoEm, limiteDaJanela),
      })
      .returning({ chave: chavesIdempotencia.chave });
    if (reservadas.length > 0) return { reservada: true };
    return { reservada: false, existente: await this.buscarConfirmada(pedido) };
  }

  async gravarResposta(input: ChaveDaFamilia & { resposta: RespostaGravada }): Promise<void> {
    const { statusCode, corpo } = input.resposta;
    const atualizadas = await this.executor
      .update(chavesIdempotencia)
      .set({ statusCode, resposta: corpo })
      .where(daChave(input))
      .returning({ chave: chavesIdempotencia.chave });
    if (atualizadas.length === 0) throw new ReservaAusenteError(input);
  }

  async removerExpiradas(): Promise<number> {
    const removidas = await this.executor
      .delete(chavesIdempotencia)
      .where(lt(chavesIdempotencia.criadoEm, limiteDaJanela))
      .returning({ chave: chavesIdempotencia.chave });
    return removidas.length;
  }

  private async buscarConfirmada(alvo: ChaveDaFamilia): Promise<RegistroIdempotencia> {
    const [linha] = await this.executor
      .select(colunasRegistro)
      .from(chavesIdempotencia)
      .where(daChave(alvo));
    if (!linha) {
      throw new Error(
        `Chave de idempotência ${descrever(alvo)}: esperado registro visível após conflito ` +
          'no índice único, nenhum encontrado (removido entre as consultas?) — repita a requisição',
      );
    }
    return paraRegistro(linha);
  }
}

/**
 * Fake nomeada para testes e NODE_ENV=test: participa da `InMemoryUnitOfWork`
 * (staging descartado no rollback leva a reserva junto). Não serializa
 * execuções concorrentes — a espera no índice único é provada no PostgreSQL.
 */
export class InMemoryIdempotenciaRepository
  implements IdempotenciaRepository, ParticipanteInMemory<InMemoryIdempotenciaRepository>
{
  private registros: RegistroIdempotencia[] = [];

  constructor(private readonly agora: () => Date = () => new Date()) {}

  abrirStaging(): InMemoryIdempotenciaRepository {
    const staging = new InMemoryIdempotenciaRepository(this.agora);
    staging.registros = [...this.registros];
    return staging;
  }

  publicar(staging: InMemoryIdempotenciaRepository): void {
    this.registros = [...staging.registros];
  }

  async reservar(pedido: PedidoIdempotente): Promise<ResultadoReserva> {
    const existente = this.buscar(pedido);
    if (existente && !this.expirado(existente)) return { reservada: false, existente };
    const nova = { ...pedido, resposta: null, criadoEm: this.agora() };
    this.registros = [...this.registros.filter((r) => r !== existente), nova];
    return { reservada: true };
  }

  async gravarResposta(input: ChaveDaFamilia & { resposta: RespostaGravada }): Promise<void> {
    const atual = this.buscar(input);
    if (!atual) throw new ReservaAusenteError(input);
    // Substitui o objeto (nunca muta): o staging é cópia rasa da base.
    const gravado = { ...atual, resposta: input.resposta };
    this.registros = this.registros.map((r) => (r === atual ? gravado : r));
  }

  async removerExpiradas(): Promise<number> {
    const antes = this.registros.length;
    this.registros = this.registros.filter((r) => !this.expirado(r));
    return antes - this.registros.length;
  }

  /** Inspeção para testes: chaves confirmadas da família. */
  chavesDa(familiaId: string): string[] {
    return this.registros.filter((r) => r.familiaId === familiaId).map((r) => r.chave);
  }

  private buscar({ familiaId, chave }: ChaveDaFamilia): RegistroIdempotencia | undefined {
    return this.registros.find((r) => r.familiaId === familiaId && r.chave === chave);
  }

  private expirado(registro: RegistroIdempotencia): boolean {
    return this.agora().getTime() - registro.criadoEm.getTime() > JANELA_REPLAY_MS;
  }
}
