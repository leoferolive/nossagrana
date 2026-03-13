import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import type {
  AuthRepository,
  LoginInput,
  RegisterUserInput,
  RegisteredUser,
} from './auth.types.js';

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email ja cadastrado');
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Credenciais invalidas');
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> => {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) {
    return false;
  }

  const hashBuffer = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(storedHash, 'hex');

  if (hashBuffer.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(hashBuffer, storedHashBuffer);
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hashFn: (password: string) => Promise<string> = hashPassword,
    private readonly verifyFn: (
      password: string,
      hash: string,
    ) => Promise<boolean> = verifyPassword,
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

  async login(input: LoginInput): Promise<{ id: string; email: string }> {
    const user = await this.repository.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.verifyFn(input.senha, user.senhaHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return {
      id: user.id,
      email: user.email,
    };
  }
}
