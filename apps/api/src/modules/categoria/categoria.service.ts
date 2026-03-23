import type { CategoriaRepository } from './categoria.types.js';

export class CategoriaNotFoundError extends Error {
  constructor() {
    super('Categoria nao encontrada');
  }
}

export class CategoriaSistemaError extends Error {
  constructor() {
    super('Categorias de sistema não podem ser editadas ou removidas');
  }
}

export class CategoriaService {
  constructor(private readonly categoriaRepository: CategoriaRepository) {}

  async listByFamiliaId(input: { familiaId: string }) {
    return this.categoriaRepository.listByFamiliaId({
      familiaId: input.familiaId,
    });
  }

  async create(input: {
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
    criadoPor: string;
  }) {
    return this.categoriaRepository.create({
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
      criadoPor: input.criadoPor,
    });
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
  }) {
    const existing = await this.categoriaRepository.findById({
      id: input.id,
      familiaId: input.familiaId,
    });

    if (!existing) {
      throw new CategoriaNotFoundError();
    }

    if (existing.sistema) {
      throw new CategoriaSistemaError();
    }

    const updated = await this.categoriaRepository.update({
      id: input.id,
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
    });

    if (!updated) {
      throw new CategoriaNotFoundError();
    }

    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }) {
    const existing = await this.categoriaRepository.findById({
      id: input.id,
      familiaId: input.familiaId,
    });

    if (!existing) {
      throw new CategoriaNotFoundError();
    }

    if (existing.sistema) {
      throw new CategoriaSistemaError();
    }

    const deactivated = await this.categoriaRepository.deactivate({
      id: input.id,
      familiaId: input.familiaId,
    });

    if (!deactivated) {
      throw new CategoriaNotFoundError();
    }

    return deactivated;
  }
}
