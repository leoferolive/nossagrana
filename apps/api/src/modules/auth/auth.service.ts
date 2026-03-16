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

const isUniqueViolationError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code === '23505'
  );
};

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

    let createdUser;
    try {
      createdUser = await this.repository.createUser({
        nome: input.nome,
        email: input.email,
        senhaHash,
      });
    } catch (error) {
      if (isUniqueViolationError(error)) {
        throw new EmailAlreadyExistsError();
      }

      throw error;
    }

    return {
      id: createdUser.id,
      nome: createdUser.nome,
      email: createdUser.email,
      dataCriacao: createdUser.dataCriacao.toISOString(),
    };
  }

  async getPerfil(userId: string): Promise<{ nome: string; email: string }> {
    const user = await this.repository.findById(userId);
    if (!user) throw new InvalidCredentialsError();
    return { nome: user.nome, email: user.email };
  }

  async updatePerfil(userId: string, nome: string): Promise<{ nome: string; email: string }> {
    const updated = await this.repository.updateNome(userId, nome);
    return { nome: updated.nome, email: updated.email };
  }

  async updateSenha(userId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) throw new InvalidCredentialsError();
    const ok = await this.verifyFn(senhaAtual, user.senhaHash);
    if (!ok) throw new InvalidCredentialsError();
    const novoHash = await this.hashFn(novaSenha);
    await this.repository.updateSenhaHash(userId, novoHash);
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

  async deleteAccount(userId: string): Promise<void> {
    const familias = await this.repository.findFamiliasByUserId(userId);

    for (const { familiaId } of familias) {
      const memberCount = await this.repository.countFamiliaMembers(familiaId);
      if (memberCount <= 1) {
        await this.repository.deleteFamiliaAndAllData(familiaId);
      } else {
        await this.repository.removeUserFromFamilia(userId, familiaId);
      }
    }

    await this.repository.deleteUser(userId);
  }
}
