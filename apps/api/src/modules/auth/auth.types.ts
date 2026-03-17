export interface RegisterUserInput {
  nome: string;
  email: string;
  senha: string;
}

export interface LoginInput {
  email: string;
  senha: string;
}

export interface RegisteredUser {
  id: string;
  nome: string;
  email: string;
  dataCriacao: string;
}

export interface AuthRepositoryUser {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  dataCriacao: Date;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<AuthRepositoryUser | null>;
  findById(id: string): Promise<AuthRepositoryUser | null>;
  createUser(input: {
    nome: string;
    email: string;
    senhaHash: string;
  }): Promise<AuthRepositoryUser>;
  updateNome(id: string, nome: string): Promise<AuthRepositoryUser>;
  updateSenhaHash(id: string, senhaHash: string): Promise<void>;
  findFamiliasByUserId(userId: string): Promise<Array<{ familiaId: string }>>;
  countFamiliaMembers(familiaId: string): Promise<number>;
  deleteFamiliaAndAllData(familiaId: string): Promise<void>;
  removeUserFromFamilia(userId: string, familiaId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

export const authTypesRuntimeMarker = true;
