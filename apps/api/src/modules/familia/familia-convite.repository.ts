import { and, eq, exists, gt, isNull, sql } from 'drizzle-orm';

import type { ExecutorDrizzle, TransacaoDrizzle } from '../../db/executor.types.js';
import { convites, familias, usuarioFamilia } from '../../db/schema.js';
import { classificarConvite, ehRepeticaoDoConsumidor } from './familia-convite.js';
import type {
  ConsumoConviteResultado,
  CreatedFamilia,
  JoinFamiliaByInviteInput,
} from './familia.types.js';

/**
 * Sinal interno para desfazer o consumo quando o usuário já é membro: o
 * ROLLBACK devolve o convite ao estado "livre" (não queima convite à toa).
 */
class UsuarioJaMembroSinal extends Error {
  constructor(readonly familia: CreatedFamilia) {
    super('usuário já é membro da família do convite');
  }
}

/**
 * Consumo atômico e de uso único de convite (#67). O UPDATE condicional
 * (`usado_por IS NULL` + validade + família ativa) é o único ponto de decisão:
 * o banco serializa duas requisições concorrentes na mesma linha e a perdedora
 * reavalia a condição depois do commit da vencedora, vendo zero linhas. A
 * membership entra na MESMA transação; a PK (usuario_id, familia_id) impede
 * vínculo duplicado mesmo que outro caminho (aprovação de solicitação) corra junto.
 */
export class DrizzleConviteConsumer {
  constructor(private readonly executor: ExecutorDrizzle) {}

  /**
   * Ex.: `consumir({ codigo: 'A1B2C3D4E5F6', usuarioId }, new Date())` →
   * `{ status: 'entrou', familia }` na 1ª chamada e `{ status: 'usado' }` nas demais.
   */
  async consumir(
    input: JoinFamiliaByInviteInput,
    agora: Date = new Date(),
  ): Promise<ConsumoConviteResultado> {
    try {
      return await this.executor.transaction((tx) => this.consumirNaTransacao(tx, input, agora));
    } catch (erro) {
      if (erro instanceof UsuarioJaMembroSinal) {
        return { status: 'ja_membro', familia: erro.familia };
      }
      throw erro;
    }
  }

  private async consumirNaTransacao(
    tx: TransacaoDrizzle,
    input: JoinFamiliaByInviteInput,
    agora: Date,
  ): Promise<ConsumoConviteResultado> {
    const consumido = await this.marcarComoUsado(tx, input, agora);
    if (!consumido) return this.explicarRecusa(tx, input, agora);

    const vinculou = await this.vincularMembro(tx, input.usuarioId, consumido.familiaId);
    const familia = await this.buscarFamilia(tx, consumido.familiaId);
    if (!vinculou) throw new UsuarioJaMembroSinal(familia);
    return { status: 'entrou', familia };
  }

  /** UPDATE condicional: o único ponto de decisão do uso único. */
  private async marcarComoUsado(
    tx: TransacaoDrizzle,
    input: JoinFamiliaByInviteInput,
    agora: Date,
  ) {
    const [consumido] = await tx
      .update(convites)
      .set({ usadoPor: input.usuarioId, usadoEm: agora })
      .where(
        and(
          eq(convites.codigo, input.codigo),
          isNull(convites.usadoPor),
          gt(convites.expiraEm, agora),
          exists(this.familiaAtivaDoConvite(tx)),
        ),
      )
      .returning({ familiaId: convites.familiaId });
    return consumido;
  }

  /** `false` quando o vínculo já existia (ON CONFLICT DO NOTHING não retorna linha). */
  private async vincularMembro(tx: TransacaoDrizzle, usuarioId: string, familiaId: string) {
    const [vinculo] = await tx
      .insert(usuarioFamilia)
      .values({ usuarioId, familiaId, role: 'membro' })
      .onConflictDoNothing()
      .returning({ usuarioId: usuarioFamilia.usuarioId });
    return Boolean(vinculo);
  }

  private familiaAtivaDoConvite(tx: TransacaoDrizzle) {
    return tx
      .select({ um: sql`1` })
      .from(familias)
      .where(and(eq(familias.id, convites.familiaId), isNull(familias.deletedAt)));
  }

  private async buscarFamilia(tx: TransacaoDrizzle, familiaId: string): Promise<CreatedFamilia> {
    const [familia] = await tx
      .select({ id: familias.id, nome: familias.nome, dataCriacao: familias.dataCriacao })
      .from(familias)
      .where(eq(familias.id, familiaId));
    if (!familia) {
      throw new Error(`Família ${familiaId} do convite não encontrada: esperado FK válida`);
    }
    return familia;
  }

  /** Só roda quando o UPDATE não casou: descobre o motivo, sem alterar nada. */
  private async explicarRecusa(
    tx: TransacaoDrizzle,
    input: JoinFamiliaByInviteInput,
    agora: Date,
  ): Promise<ConsumoConviteResultado> {
    const convite = await this.buscarConvite(tx, input.codigo);
    const estado = convite?.familiaExcluidaEm
      ? 'invalido'
      : classificarConvite(convite ?? null, agora);
    if (convite && ehRepeticaoDoConsumidor(estado, convite.usadoPor, input.usuarioId)) {
      const familia = await this.familiaSeAindaMembro(tx, input.usuarioId, convite.familiaId);
      if (familia) return { status: 'ja_membro', familia };
    }
    return { status: estado === 'elegivel' ? 'invalido' : estado };
  }

  private async buscarConvite(tx: TransacaoDrizzle, codigo: string) {
    const [convite] = await tx
      .select({
        familiaId: convites.familiaId,
        usadoPor: convites.usadoPor,
        expiraEm: convites.expiraEm,
        familiaExcluidaEm: familias.deletedAt,
      })
      .from(convites)
      .innerJoin(familias, eq(familias.id, convites.familiaId))
      .where(eq(convites.codigo, codigo))
      .limit(1);
    return convite;
  }

  private async familiaSeAindaMembro(tx: TransacaoDrizzle, usuarioId: string, familiaId: string) {
    const [vinculo] = await tx
      .select({ usuarioId: usuarioFamilia.usuarioId })
      .from(usuarioFamilia)
      .where(and(eq(usuarioFamilia.usuarioId, usuarioId), eq(usuarioFamilia.familiaId, familiaId)))
      .limit(1);
    return vinculo ? this.buscarFamilia(tx, familiaId) : null;
  }
}
