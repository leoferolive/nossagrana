export interface CreateFamiliaInput {
  nome: string;
  usuarioId: string;
}

export interface CreateFamiliaInviteInput {
  familiaId: string;
  criadoPor: string;
}

export interface JoinFamiliaByInviteInput {
  codigo: string;
  usuarioId: string;
}

export interface RequestFamiliaJoinInput {
  familiaId: string;
  usuarioId: string;
}

export interface CreatedFamilia {
  id: string;
  nome: string;
  dataCriacao: Date;
}

export interface CreatedFamiliaInvite {
  id: string;
  familiaId: string;
  codigo: string;
  expiraEm: Date;
  criadoPor: string;
  dataCriacao: Date;
}

export interface CreatedFamiliaJoinRequest {
  id: string;
  familiaId: string;
  usuarioId: string;
  status: 'pendente' | 'aprovada' | 'rejeitada';
  solicitadoEm: Date;
  respondidoEm?: Date;
  respondidoPor?: string;
}

export interface ReviewedFamiliaJoinRequest {
  id: string;
  familiaId: string;
  usuarioId: string;
  status: 'aprovada' | 'rejeitada';
  solicitadoEm: Date;
  respondidoEm: Date;
  respondidoPor: string;
}

export interface FamiliaMember {
  usuarioId: string;
  familiaId: string;
  nome: string;
  role: 'admin' | 'membro';
  dataEntrada: Date;
}

export interface FamiliaMinhasItem {
  id: string;
  nome: string;
  role: 'admin' | 'membro';
  dataEntrada: Date;
}

export interface FamiliaRepository {
  listFamiliasByUsuarioId(input: { usuarioId: string }): Promise<FamiliaMinhasItem[]>;
  createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia>;
  isUserAdmin(input: { familiaId: string; usuarioId: string }): Promise<boolean>;
  hasMembership(input: { familiaId: string; usuarioId: string }): Promise<boolean>;
  createInvite(input: CreateFamiliaInviteInput): Promise<CreatedFamiliaInvite>;
  joinByInvite(input: JoinFamiliaByInviteInput): Promise<CreatedFamilia | null>;
  requestJoin(input: RequestFamiliaJoinInput): Promise<CreatedFamiliaJoinRequest>;
  listPendingJoinRequests(input: { familiaId: string }): Promise<CreatedFamiliaJoinRequest[]>;
  reviewJoinRequest(input: {
    solicitacaoId: string;
    familiaId: string;
    adminId: string;
    acao: 'aprovar' | 'rejeitar';
  }): Promise<ReviewedFamiliaJoinRequest | null>;
  listMembers(input: { familiaId: string }): Promise<FamiliaMember[]>;
  removeMember(input: { familiaId: string; usuarioId: string }): Promise<boolean>;
  deleteFamily(input: { familiaId: string }): Promise<boolean>;
  buscarPorNome(nome: string): Promise<Array<{ id: string; nome: string }>>;
}

export const familiaTypesRuntimeMarker = true;
