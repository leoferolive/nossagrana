import type { FamiliaDoUsuario, FamiliaRepository, SolicitacaoRecord, UsuarioFamiliaRecord } from './familia.types.js';

export class NaoAutorizadoError extends Error {
  constructor() {
    super('Nao autorizado');
  }
}

export class MembroJaExisteError extends Error {
  constructor() {
    super('Usuario ja e membro desta familia');
  }
}

export class ConviteInvalidoError extends Error {
  constructor() {
    super('Convite invalido');
  }
}

export class ConviteExpiradoError extends Error {
  constructor() {
    super('Convite expirado');
  }
}

export class SolicitacaoNaoEncontradaError extends Error {
  constructor() {
    super('Solicitacao nao encontrada');
  }
}

interface CriarFamiliaResult {
  id: string;
  nome: string;
  role: 'admin';
  dataCriacao: string;
}

export class FamiliaService {
  constructor(private readonly repo: FamiliaRepository) {}

  async criarFamilia(input: { nome: string; adminUserId: string }): Promise<CriarFamiliaResult> {
    const familia = await this.repo.criarFamilia(input);
    return {
      id: familia.id,
      nome: familia.nome,
      role: 'admin',
      dataCriacao: familia.dataCriacao.toISOString(),
    };
  }

  async gerarConvite(input: { familiaId: string; adminUserId: string }): Promise<{ codigo: string; expiraEm: string }> {
    const membro = await this.repo.buscarMembro(input.adminUserId, input.familiaId);
    if (!membro || membro.role !== 'admin') throw new NaoAutorizadoError();

    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const convite = await this.repo.criarConvite({ familiaId: input.familiaId, criadoPor: input.adminUserId, expiraEm });
    return { codigo: convite.codigo, expiraEm: convite.expiraEm.toISOString() };
  }

  async entrarViaConvite(input: { codigo: string; usuarioId: string }): Promise<UsuarioFamiliaRecord> {
    const convite = await this.repo.buscarConvitePorCodigo(input.codigo);
    if (!convite) throw new ConviteInvalidoError();
    if (convite.expiraEm < new Date()) throw new ConviteExpiradoError();

    const membroExistente = await this.repo.buscarMembro(input.usuarioId, convite.familiaId);
    if (membroExistente) throw new MembroJaExisteError();

    const membro = await this.repo.adicionarMembro({ usuarioId: input.usuarioId, familiaId: convite.familiaId, role: 'membro' });
    await this.repo.marcarConviteUsado(convite.id, input.usuarioId);
    return membro;
  }

  async solicitarEntrada(input: { familiaId: string; usuarioId: string }): Promise<SolicitacaoRecord> {
    const membroExistente = await this.repo.buscarMembro(input.usuarioId, input.familiaId);
    if (membroExistente) throw new MembroJaExisteError();
    return await this.repo.criarSolicitacao(input);
  }

  async avaliarSolicitacao(input: {
    solicitacaoId: string;
    familiaId: string;
    adminUserId: string;
    acao: 'aprovar' | 'rejeitar';
  }): Promise<SolicitacaoRecord> {
    const membro = await this.repo.buscarMembro(input.adminUserId, input.familiaId);
    if (!membro || membro.role !== 'admin') throw new NaoAutorizadoError();

    const solicitacao = await this.repo.buscarSolicitacao(input.solicitacaoId);
    if (!solicitacao) throw new SolicitacaoNaoEncontradaError();

    const status = input.acao === 'aprovar' ? 'aprovada' : 'rejeitada';
    const updated = await this.repo.atualizarSolicitacao(input.solicitacaoId, status);

    if (input.acao === 'aprovar') {
      await this.repo.adicionarMembro({ usuarioId: solicitacao.usuarioId, familiaId: input.familiaId, role: 'membro' });
    }

    return updated;
  }

  async removerMembro(input: { familiaId: string; membroId: string; adminUserId: string }): Promise<void> {
    const admin = await this.repo.buscarMembro(input.adminUserId, input.familiaId);
    if (!admin || admin.role !== 'admin') throw new NaoAutorizadoError();
    if (input.membroId === input.adminUserId) throw new NaoAutorizadoError();

    await this.repo.removerMembro(input.membroId, input.familiaId);
  }

  async excluirFamilia(input: { familiaId: string; adminUserId: string }): Promise<void> {
    const membro = await this.repo.buscarMembro(input.adminUserId, input.familiaId);
    if (!membro || membro.role !== 'admin') throw new NaoAutorizadoError();
    await this.repo.excluirFamilia(input.familiaId);
  }

  async listarFamilias(usuarioId: string): Promise<FamiliaDoUsuario[]> {
    return await this.repo.buscarFamiliasDoUsuario(usuarioId);
  }

  async listarMembros(input: { familiaId: string; usuarioId: string }) {
    const membro = await this.repo.buscarMembro(input.usuarioId, input.familiaId);
    if (!membro) throw new NaoAutorizadoError();
    return await this.repo.buscarMembrosPorFamilia(input.familiaId);
  }

  async listarSolicitacoesPendentes(input: { familiaId: string; adminUserId: string }) {
    const membro = await this.repo.buscarMembro(input.adminUserId, input.familiaId);
    if (!membro || membro.role !== 'admin') throw new NaoAutorizadoError();
    return await this.repo.buscarSolicitacoesPendentes(input.familiaId);
  }
}
