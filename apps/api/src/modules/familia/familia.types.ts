export interface CreateFamiliaInput {
  nome: string;
  usuarioId: string;
}

export interface CreatedFamilia {
  id: string;
  nome: string;
  dataCriacao: Date;
}

export interface FamiliaRepository {
  createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia>;
}
