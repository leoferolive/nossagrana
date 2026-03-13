export interface Categoria {
  id: string;
  familiaId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  ativo: boolean;
  criadoPor: string;
  criadoEm: Date;
}

export interface CategoriaRepository {
  listByFamiliaId(input: { familiaId: string }): Promise<Categoria[]>;
  create(input: {
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
    criadoPor: string;
  }): Promise<Categoria>;
  update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
  }): Promise<Categoria | null>;
}

export const categoriaTypesRuntimeMarker = true;
