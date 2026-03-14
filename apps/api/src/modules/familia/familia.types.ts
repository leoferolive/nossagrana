import type { FamilyRole } from '@nossagrana/types';

export interface FamiliaRepository {
  criarFamilia(input: { nome: string; adminUserId: string }): Promise<FamiliaRecord>;
  buscarMembro(usuarioId: string, familiaId: string): Promise<UsuarioFamiliaRecord | null>;
  buscarMembrosPorFamilia(familiaId: string): Promise<MembroRecord[]>;
  adicionarMembro(input: { usuarioId: string; familiaId: string; role: FamilyRole }): Promise<UsuarioFamiliaRecord>;
  removerMembro(usuarioId: string, familiaId: string): Promise<void>;
  excluirFamilia(familiaId: string): Promise<void>;
  buscarFamiliasDoUsuario(usuarioId: string): Promise<FamiliaDoUsuario[]>;
  criarConvite(input: { familiaId: string; criadoPor: string; expiraEm: Date }): Promise<ConviteRecord>;
  buscarConvitePorCodigo(codigo: string): Promise<ConviteRecord | null>;
  marcarConviteUsado(conviteId: string, usuarioId: string): Promise<void>;
  criarSolicitacao(input: { familiaId: string; usuarioId: string }): Promise<SolicitacaoRecord>;
  buscarSolicitacoesPendentes(familiaId: string): Promise<SolicitacaoRecord[]>;
  atualizarSolicitacao(solicitacaoId: string, status: 'aprovada' | 'rejeitada'): Promise<SolicitacaoRecord>;
  buscarSolicitacao(solicitacaoId: string): Promise<SolicitacaoRecord | null>;
}

export interface FamiliaRecord {
  id: string;
  nome: string;
  dataCriacao: Date;
}

export interface UsuarioFamiliaRecord {
  usuarioId: string;
  familiaId: string;
  role: FamilyRole;
  dataEntrada: Date;
}

export interface MembroRecord {
  usuarioId: string;
  nome: string;
  email: string;
  role: FamilyRole;
  dataEntrada: Date;
}

export interface FamiliaDoUsuario {
  id: string;
  nome: string;
  role: FamilyRole;
  dataCriacao: Date;
}

export interface ConviteRecord {
  id: string;
  familiaId: string;
  codigo: string;
  criadoPor: string;
  expiraEm: Date;
  usadoPor: string | null;
  usadoEm: Date | null;
  dataCriacao: Date;
}

export interface SolicitacaoRecord {
  id: string;
  familiaId: string;
  usuarioId: string;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  solicitadoEm: Date;
}
