import { randomBytes, scryptSync } from 'node:crypto';

import type { AuthRepository, RegisterUserInput, RegisteredUser } from './auth.types.js';

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email ja cadastrado');
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hashFn: (password: string) => Promise<string> = hashPassword,
  ) {}

  async register(input: RegisterUserInput): Promise<RegisteredUser> {
    const existingUser = await this.repository.findByEmail(input.email);
    if (existingUser) {
      throw new EmailAlreadyExistsError();
    }

    const senhaHash = await this.hashFn(input.senha);

    const createdUser = await this.repository.createUser({
      nome: input.nome,
      email: input.email,
      senhaHash,
    });

    return {
      id: createdUser.id,
      nome: createdUser.nome,
      email: createdUser.email,
      dataCriacao: createdUser.dataCriacao.toISOString(),
    };
  }
}
