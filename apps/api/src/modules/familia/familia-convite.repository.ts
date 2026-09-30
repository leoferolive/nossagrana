import { and, eq, exists, gt, isNull, sql } from 'drizzle-orm';

import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { convites, familias, usuarioFamilia } from '../../db/schema.js';
import { classificarConvite } from './familia-convite.js';
import type {
  ConsumoConviteResultado,
  CreatedFamilia,
  JoinFamiliaByInviteInput,
} from './familia.types.js';

type Transacao = Parameters<Parameters<ExecutorDrizzle['transaction']>[0]>[0];

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
    tx: Transacao,
    input: JoinFamiliaByInviteInput,
    agora: Date,
  ): Promise<ConsumoConviteResultado> {
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
    if (!consumido) return this.explicarRecusa(tx, input.codigo, agora);

    const [vinculo] = await tx
      .insert(usuarioFamilia)
      .values({ usuarioId: input.usuarioId, familiaId: consumido.familiaId, role: 'membro' })
      .onConflictDoNothing()
      .returning({ usuarioId: usuarioFamilia.usuarioId });
    const familia = await this.buscarFamilia(tx, consumido.familiaId);
    if (!vinculo) throw new UsuarioJaMembroSinal(familia);
    return { status: 'entrou', familia };
  }

  private familiaAtivaDoConvite(tx: Transacao) {
    return tx
      .select({ um: sql`1` })
      .from(familias)
      .where(and(eq(familias.id, convites.familiaId), isNull(familias.deletedAt)));
  }

  private async buscarFamilia(tx: Transacao, familiaId: string): Promise<CreatedFamilia> {
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
    tx: Transacao,
    codigo: string,
    agora: Date,
  ): Promise<ConsumoConviteResultado> {
    const [convite] = await tx
      .select({
        usadoPor: convites.usadoPor,
        expiraEm: convites.expiraEm,
        familiaExcluidaEm: familias.deletedAt,
      })
      .from(convites)
      .innerJoin(familias, eq(familias.id, convites.familiaId))
      .where(eq(convites.codigo, codigo))
      .limit(1);

    const estado = convite?.familiaExcluidaEm
      ? 'invalido'
      : classificarConvite(convite ?? null, agora);
    return { status: estado === 'elegivel' ? 'invalido' : estado };
  }
}
