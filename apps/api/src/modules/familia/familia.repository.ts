import { and, eq } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';

import { db } from '../../db/client.js';
import { convites, familias, solicitacoesEntrada, usuarioFamilia, users } from '../../db/schema.js';
import type {
  ConviteRecord,
  FamiliaDoUsuario,
  FamiliaRecord,
  FamiliaRepository,
  MembroRecord,
  SolicitacaoRecord,
  UsuarioFamiliaRecord,
} from './familia.types.js';
import type { FamilyRole } from '@nossagrana/types';

// ─── In-Memory ───────────────────────────────────────────────────────────────

export class InMemoryFamiliaRepository implements FamiliaRepository {
  private familias = new Map<string, FamiliaRecord>();
  private membros = new Map<string, UsuarioFamiliaRecord & { nome?: string; email?: string }>();
  private convites = new Map<string, ConviteRecord>();
  private solicitacoes = new Map<string, SolicitacaoRecord>();

  private memberKey(usuarioId: string, familiaId: string): string {
    return `${usuarioId}:${familiaId}`;
  }

  async criarFamilia(input: { nome: string; adminUserId: string }): Promise<FamiliaRecord> {
    const familia: FamiliaRecord = { id: randomUUID(), nome: input.nome, dataCriacao: new Date() };
    this.familias.set(familia.id, familia);
    await this.adicionarMembro({ usuarioId: input.adminUserId, familiaId: familia.id, role: 'admin' });
    return familia;
  }

  async buscarMembro(usuarioId: string, familiaId: string): Promise<UsuarioFamiliaRecord | null> {
    return this.membros.get(this.memberKey(usuarioId, familiaId)) ?? null;
  }

  async buscarMembrosPorFamilia(familiaId: string): Promise<MembroRecord[]> {
    return [...this.membros.values()]
      .filter((m) => m.familiaId === familiaId)
      .map((m) => ({
        usuarioId: m.usuarioId,
        nome: m.nome ?? 'Nome',
        email: m.email ?? 'email@test.com',
        role: m.role,
        dataEntrada: m.dataEntrada,
      }));
  }

  async adicionarMembro(input: { usuarioId: string; familiaId: string; role: FamilyRole }): Promise<UsuarioFamiliaRecord> {
    const membro: UsuarioFamiliaRecord = {
      usuarioId: input.usuarioId,
      familiaId: input.familiaId,
      role: input.role,
      dataEntrada: new Date(),
    };
    this.membros.set(this.memberKey(input.usuarioId, input.familiaId), membro);
    return membro;
  }

  async removerMembro(usuarioId: string, familiaId: string): Promise<void> {
    this.membros.delete(this.memberKey(usuarioId, familiaId));
  }

  async excluirFamilia(familiaId: string): Promise<void> {
    this.familias.delete(familiaId);
    for (const key of this.membros.keys()) {
      if (key.endsWith(`:${familiaId}`)) this.membros.delete(key);
    }
  }

  async buscarFamiliasDoUsuario(usuarioId: string): Promise<FamiliaDoUsuario[]> {
    return [...this.membros.values()]
      .filter((m) => m.usuarioId === usuarioId)
      .map((m) => {
        const familia = this.familias.get(m.familiaId);
        return familia ? { id: familia.id, nome: familia.nome, role: m.role, dataCriacao: familia.dataCriacao } : null;
      })
      .filter((f): f is FamiliaDoUsuario => f !== null);
  }

  async criarConvite(input: { familiaId: string; criadoPor: string; expiraEm: Date }): Promise<ConviteRecord> {
    const codigo = randomBytes(4).toString('hex').toUpperCase();
    const convite: ConviteRecord = {
      id: randomUUID(),
      familiaId: input.familiaId,
      codigo,
      criadoPor: input.criadoPor,
      expiraEm: input.expiraEm,
      usadoPor: null,
      usadoEm: null,
      dataCriacao: new Date(),
    };
    this.convites.set(codigo, convite);
    return convite;
  }

  async buscarConvitePorCodigo(codigo: string): Promise<ConviteRecord | null> {
    return this.convites.get(codigo) ?? null;
  }

  async marcarConviteUsado(conviteId: string, usuarioId: string): Promise<void> {
    for (const [key, convite] of this.convites.entries()) {
      if (convite.id === conviteId) {
        this.convites.set(key, { ...convite, usadoPor: usuarioId, usadoEm: new Date() });
        break;
      }
    }
  }

  async criarSolicitacao(input: { familiaId: string; usuarioId: string }): Promise<SolicitacaoRecord> {
    const sol: SolicitacaoRecord = {
      id: randomUUID(),
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
      status: 'pendente',
      solicitadoEm: new Date(),
    };
    this.solicitacoes.set(sol.id, sol);
    return sol;
  }

  async buscarSolicitacoesPendentes(familiaId: string): Promise<SolicitacaoRecord[]> {
    return [...this.solicitacoes.values()].filter((s) => s.familiaId === familiaId && s.status === 'pendente');
  }

  async atualizarSolicitacao(solicitacaoId: string, status: 'aprovada' | 'rejeitada'): Promise<SolicitacaoRecord> {
    const sol = this.solicitacoes.get(solicitacaoId);
    if (!sol) throw new Error('Solicitação não encontrada');
    const updated = { ...sol, status };
    this.solicitacoes.set(solicitacaoId, updated);
    return updated;
  }

  async buscarSolicitacao(solicitacaoId: string): Promise<SolicitacaoRecord | null> {
    return this.solicitacoes.get(solicitacaoId) ?? null;
  }
}

// ─── Drizzle ─────────────────────────────────────────────────────────────────

export class DrizzleFamiliaRepository implements FamiliaRepository {
  async criarFamilia(input: { nome: string; adminUserId: string }): Promise<FamiliaRecord> {
    return await db.transaction(async (tx) => {
      const [familia] = await tx.insert(familias).values({ nome: input.nome }).returning();
      await tx.insert(usuarioFamilia).values({
        usuarioId: input.adminUserId,
        familiaId: familia.id,
        role: 'admin',
      });
      return familia;
    });
  }

  async buscarMembro(usuarioId: string, familiaId: string): Promise<UsuarioFamiliaRecord | null> {
    const [membro] = await db
      .select()
      .from(usuarioFamilia)
      .where(and(eq(usuarioFamilia.usuarioId, usuarioId), eq(usuarioFamilia.familiaId, familiaId)))
      .limit(1);
    return membro ?? null;
  }

  async buscarMembrosPorFamilia(familiaId: string): Promise<MembroRecord[]> {
    return await db
      .select({
        usuarioId: usuarioFamilia.usuarioId,
        nome: users.nome,
        email: users.email,
        role: usuarioFamilia.role,
        dataEntrada: usuarioFamilia.dataEntrada,
      })
      .from(usuarioFamilia)
      .innerJoin(users, eq(usuarioFamilia.usuarioId, users.id))
      .where(eq(usuarioFamilia.familiaId, familiaId));
  }

  async adicionarMembro(input: { usuarioId: string; familiaId: string; role: FamilyRole }): Promise<UsuarioFamiliaRecord> {
    const [membro] = await db.insert(usuarioFamilia).values(input).returning();
    return membro;
  }

  async removerMembro(usuarioId: string, familiaId: string): Promise<void> {
    await db
      .delete(usuarioFamilia)
      .where(and(eq(usuarioFamilia.usuarioId, usuarioId), eq(usuarioFamilia.familiaId, familiaId)));
  }

  async excluirFamilia(familiaId: string): Promise<void> {
    await db.delete(familias).where(eq(familias.id, familiaId));
  }

  async buscarFamiliasDoUsuario(usuarioId: string): Promise<FamiliaDoUsuario[]> {
    return await db
      .select({
        id: familias.id,
        nome: familias.nome,
        role: usuarioFamilia.role,
        dataCriacao: familias.dataCriacao,
      })
      .from(usuarioFamilia)
      .innerJoin(familias, eq(usuarioFamilia.familiaId, familias.id))
      .where(eq(usuarioFamilia.usuarioId, usuarioId));
  }

  async criarConvite(input: { familiaId: string; criadoPor: string; expiraEm: Date }): Promise<ConviteRecord> {
    const codigo = randomBytes(4).toString('hex').toUpperCase();
    const [convite] = await db
      .insert(convites)
      .values({ familiaId: input.familiaId, criadoPor: input.criadoPor, expiraEm: input.expiraEm, codigo })
      .returning();
    return { ...convite, usadoPor: convite.usadoPor, usadoEm: convite.usadoEm };
  }

  async buscarConvitePorCodigo(codigo: string): Promise<ConviteRecord | null> {
    const [convite] = await db.select().from(convites).where(eq(convites.codigo, codigo)).limit(1);
    return convite ? { ...convite, usadoPor: convite.usadoPor, usadoEm: convite.usadoEm } : null;
  }

  async marcarConviteUsado(conviteId: string, usuarioId: string): Promise<void> {
    await db
      .update(convites)
      .set({ usadoPor: usuarioId, usadoEm: new Date() })
      .where(eq(convites.id, conviteId));
  }

  async criarSolicitacao(input: { familiaId: string; usuarioId: string }): Promise<SolicitacaoRecord> {
    const [sol] = await db.insert(solicitacoesEntrada).values({ ...input, status: 'pendente' }).returning();
    return { id: sol.id, familiaId: sol.familiaId, usuarioId: sol.usuarioId, status: sol.status as 'pendente' | 'aprovada' | 'rejeitada', solicitadoEm: sol.solicitadoEm };
  }

  async buscarSolicitacoesPendentes(familiaId: string): Promise<SolicitacaoRecord[]> {
    const rows = await db
      .select()
      .from(solicitacoesEntrada)
      .where(and(eq(solicitacoesEntrada.familiaId, familiaId), eq(solicitacoesEntrada.status, 'pendente')));
    return rows.map((r) => ({ id: r.id, familiaId: r.familiaId, usuarioId: r.usuarioId, status: r.status as 'pendente' | 'aprovada' | 'rejeitada', solicitadoEm: r.solicitadoEm }));
  }

  async atualizarSolicitacao(solicitacaoId: string, status: 'aprovada' | 'rejeitada'): Promise<SolicitacaoRecord> {
    const [sol] = await db
      .update(solicitacoesEntrada)
      .set({ status })
      .where(eq(solicitacoesEntrada.id, solicitacaoId))
      .returning();
    return { id: sol.id, familiaId: sol.familiaId, usuarioId: sol.usuarioId, status: sol.status as 'pendente' | 'aprovada' | 'rejeitada', solicitadoEm: sol.solicitadoEm };
  }

  async buscarSolicitacao(solicitacaoId: string): Promise<SolicitacaoRecord | null> {
    const [sol] = await db.select().from(solicitacoesEntrada).where(eq(solicitacoesEntrada.id, solicitacaoId)).limit(1);
    return sol ? { id: sol.id, familiaId: sol.familiaId, usuarioId: sol.usuarioId, status: sol.status as 'pendente' | 'aprovada' | 'rejeitada', solicitadoEm: sol.solicitadoEm } : null;
  }
}
