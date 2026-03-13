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
}
