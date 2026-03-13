import type { FamiliaRepository } from './familia.types.js';

interface CreateFamiliaInput {
  nome: string;
  usuarioId: string;
}

export class FamiliaService {
  constructor(private readonly familiaRepository: FamiliaRepository) {}

  async create(input: CreateFamiliaInput) {
    return this.familiaRepository.createWithAdminMembership({
      nome: input.nome,
      usuarioId: input.usuarioId,
    });
  }
}
