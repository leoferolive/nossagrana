import {
  CATEGORIAS_PADRAO_DESPESA,
  CATEGORIAS_PADRAO_RECEITA,
} from '../../db/seeds/categorias-padrao.js';
import type { CategoriaRepository } from '../categoria/categoria.types.js';
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

export class ForbiddenFamiliaJoinRequestListError extends Error {
  constructor() {
    super('Apenas admin pode listar solicitacoes');
  }
}

export class JoinRequestNotFoundError extends Error {
  constructor() {
    super('Solicitacao nao encontrada ou ja processada');
  }
}

export class ForbiddenFamiliaMemberRemovalError extends Error {
  constructor() {
    super('Apenas admin pode remover membro');
  }
}

export class SelfMemberRemovalError extends Error {
  constructor() {
    super('Admin nao pode remover a si mesmo');
  }
}

export class FamiliaMemberNotFoundError extends Error {
  constructor() {
    super('Membro nao encontrado na familia');
  }
}

export class ForbiddenActiveFamilySwitchError extends Error {
  constructor() {
    super('Usuario sem acesso a familia informada');
  }
}

export class ForbiddenFamiliaDeletionError extends Error {
  constructor() {
    super('Apenas admin pode excluir familia');
  }
}

export class FamiliaNotFoundError extends Error {
  constructor() {
    super('Familia nao encontrada');
  }
}

export class FamiliaService {
  constructor(
    private readonly familiaRepository: FamiliaRepository,
    private readonly categoriaRepository?: CategoriaRepository,
  ) {}

  async create(input: CreateFamiliaInput) {
    const familia = await this.familiaRepository.createWithAdminMembership({
      nome: input.nome,
      usuarioId: input.usuarioId,
    });

    if (this.categoriaRepository) {
      await Promise.all([
        ...CATEGORIAS_PADRAO_RECEITA.map((nome) =>
          this.categoriaRepository!.create({
            familiaId: familia.id,
            nome,
            tipo: 'receita',
            criadoPor: input.usuarioId,
          }),
        ),
        ...CATEGORIAS_PADRAO_DESPESA.map((nome) =>
          this.categoriaRepository!.create({
            familiaId: familia.id,
            nome,
            tipo: 'despesa',
            criadoPor: input.usuarioId,
          }),
        ),
      ]);
    }

    return familia;
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

  async listPendingJoinRequests(input: { familiaId: string; usuarioId: string }) {
    const isAdmin = await this.familiaRepository.isUserAdmin({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });

    if (!isAdmin) {
      throw new ForbiddenFamiliaJoinRequestListError();
    }

    return this.familiaRepository.listPendingJoinRequests({
      familiaId: input.familiaId,
    });
  }

  async reviewJoinRequest(input: {
    solicitacaoId: string;
    familiaId: string;
    usuarioId: string;
    acao: 'aprovar' | 'rejeitar';
  }) {
    const isAdmin = await this.familiaRepository.isUserAdmin({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });

    if (!isAdmin) {
      throw new ForbiddenFamiliaJoinRequestListError();
    }

    const reviewed = await this.familiaRepository.reviewJoinRequest({
      solicitacaoId: input.solicitacaoId,
      familiaId: input.familiaId,
      adminId: input.usuarioId,
      acao: input.acao,
    });

    if (!reviewed) {
      throw new JoinRequestNotFoundError();
    }

    return reviewed;
  }

  async listMembers(input: { familiaId: string }) {
    return this.familiaRepository.listMembers({
      familiaId: input.familiaId,
    });
  }

  async removeMember(input: { familiaId: string; usuarioId: string; actorId: string }) {
    const isAdmin = await this.familiaRepository.isUserAdmin({
      familiaId: input.familiaId,
      usuarioId: input.actorId,
    });

    if (!isAdmin) {
      throw new ForbiddenFamiliaMemberRemovalError();
    }

    if (input.usuarioId === input.actorId) {
      throw new SelfMemberRemovalError();
    }

    const removed = await this.familiaRepository.removeMember({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });

    if (!removed) {
      throw new FamiliaMemberNotFoundError();
    }
  }

  async switchActiveFamily(input: { familiaId: string; usuarioId: string }) {
    const hasMembership = await this.familiaRepository.hasMembership({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });

    if (!hasMembership) {
      throw new ForbiddenActiveFamilySwitchError();
    }

    return {
      familiaIdAtiva: input.familiaId,
    };
  }

  async deleteFamily(input: { familiaId: string; usuarioId: string }) {
    const isAdmin = await this.familiaRepository.isUserAdmin({
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
    });

    if (!isAdmin) {
      throw new ForbiddenFamiliaDeletionError();
    }

    const deleted = await this.familiaRepository.deleteFamily({
      familiaId: input.familiaId,
    });

    if (!deleted) {
      throw new FamiliaNotFoundError();
    }
  }
}
