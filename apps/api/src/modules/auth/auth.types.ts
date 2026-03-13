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
  createUser(input: {
    nome: string;
    email: string;
    senhaHash: string;
  }): Promise<AuthRepositoryUser>;
}
