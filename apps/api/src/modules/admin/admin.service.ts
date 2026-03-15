export class FamiliaNotFoundOrActiveError extends Error {
  constructor() {
    super('Família não encontrada ou não foi excluída');
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('Usuário não encontrado');
  }
}

export interface AdminRepository {
  findFamiliaDeleted(
    familiaId: string,
  ): Promise<{ id: string; nome: string; deletedAt: Date } | null>;
  recuperarFamilia(familiaId: string): Promise<boolean>;
  findUserById(userId: string): Promise<{ id: string; email: string; nome?: string } | null>;
}

export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  async recuperarFamilia(familiaId: string): Promise<{ id: string; nome: string }> {
    const familia = await this.repo.findFamiliaDeleted(familiaId);
    if (!familia) throw new FamiliaNotFoundOrActiveError();
    await this.repo.recuperarFamilia(familiaId);
    return { id: familia.id, nome: familia.nome };
  }

  async impersonarUsuario(userId: string): Promise<{ userId: string; email: string }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UserNotFoundError();
    return { userId: user.id, email: user.email };
  }
}
