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
}

/**
 * Porta de revogação global de sessões (#119): invalida todos os refresh tokens
 * do usuário e encerra seus sockets. Compartilhada por troca de senha, reset de
 * senha e detecção de reuso de refresh, para que os três se comportem igual.
 */
export interface SessaoRevogador {
  revogarTodas(userId: string): Promise<void>;
}

export const authTypesRuntimeMarker = true;
