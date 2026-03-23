export interface Categoria {
  id: string;
  familiaId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  ativo: boolean;
  sistema: boolean;
  criadoPor: string;
  criadoEm: Date;
}

export interface CategoriaRepository {
  listByFamiliaId(input: { familiaId: string }): Promise<Categoria[]>;
  findById(input: { id: string; familiaId: string }): Promise<Categoria | null>;
  create(input: {
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
    criadoPor: string;
    sistema?: boolean;
  }): Promise<Categoria>;
  update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
  }): Promise<Categoria | null>;
  deactivate(input: { id: string; familiaId: string }): Promise<Categoria | null>;
}

export const categoriaTypesRuntimeMarker = true;
