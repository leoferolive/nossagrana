import type { FamiliaRepository } from './familia.types.js';

interface CreateFamiliaInput {
  nome: string;
  usuarioId: string;
}

interface CreateFamiliaInviteInput {
  familiaId: string;
  usuarioId: string;
}

interface JoinFamiliaByInviteInput {
  codigo: string;
  usuarioId: string;
}

interface RequestFamiliaJoinInput {
  familiaId: string;
  usuarioId: string;
}

export class ForbiddenFamiliaInviteError extends Error {
  constructor() {
    super('Apenas admin pode gerar convite');
  }
}

export class InvalidFamiliaInviteCodeError extends Error {
  constructor() {
    super('Codigo de convite invalido ou expirado');
  }
}

export class FamiliaService {
  constructor(private readonly familiaRepository: FamiliaRepository) {}

  async create(input: CreateFamiliaInput) {
    return this.familiaRepository.createWithAdminMembership({
      nome: input.nome,
      usuarioId: input.usuarioId,
    });
  }

  async createInvite(input: CreateFamiliaInviteInput) {
    const isAdmin = await this.familiaRepository.isUserAdmin({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });

    if (!isAdmin) {
      throw new ForbiddenFamiliaInviteError();
    }

    return this.familiaRepository.createInvite({
      familiaId: input.familiaId,
      criadoPor: input.usuarioId,
    });
  }

  async joinByInvite(input: JoinFamiliaByInviteInput) {
    const familia = await this.familiaRepository.joinByInvite({
      codigo: input.codigo,
      usuarioId: input.usuarioId,
    });

    if (!familia) {
      throw new InvalidFamiliaInviteCodeError();
    }

    return familia;
  }

  async requestJoin(input: RequestFamiliaJoinInput) {
    return this.familiaRepository.requestJoin({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });
  }
}
