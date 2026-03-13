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
  status: 'pendente';
  solicitadoEm: Date;
}

export interface FamiliaRepository {
  createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia>;
  isUserAdmin(input: { familiaId: string; usuarioId: string }): Promise<boolean>;
  createInvite(input: CreateFamiliaInviteInput): Promise<CreatedFamiliaInvite>;
  joinByInvite(input: JoinFamiliaByInviteInput): Promise<CreatedFamilia | null>;
  requestJoin(input: RequestFamiliaJoinInput): Promise<CreatedFamiliaJoinRequest>;
  listPendingJoinRequests(input: { familiaId: string }): Promise<CreatedFamiliaJoinRequest[]>;
}
