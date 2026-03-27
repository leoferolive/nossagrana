export interface TemplateTransacao {
  id: string;
  familiaId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  categoriaId: string | null;
  metodoPagamentoId: string | null;
  cofrinhoId: string | null;
  ordem: number;
  valorPadrao: string | null;
  ativo: boolean;
  criadoPor: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface TemplateTransacaoWithJoins extends TemplateTransacao {
  categoriaNome: string | null;
  metodoPagamentoNome: string | null;
  cofrinhoNome: string | null;
  cofrinhoEmoji: string | null;
}

export interface CreateTemplateTransacaoInput {
  familiaId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  categoriaId?: string | null;
  metodoPagamentoId?: string | null;
  cofrinhoId?: string | null;
  ordem?: number;
  valorPadrao?: string | null;
  criadoPor: string;
}

export interface UpdateTemplateTransacaoInput {
  id: string;
  familiaId: string;
  nome?: string;
  categoriaId?: string | null;
  metodoPagamentoId?: string | null;
  cofrinhoId?: string | null;
  ordem?: number;
  valorPadrao?: string | null;
}

export interface ReordenarItem {
  id: string;
  ordem: number;
}

export interface TemplateTransacaoRepository {
  listByFamiliaId(input: { familiaId: string; tipo?: 'receita' | 'despesa' }): Promise<TemplateTransacaoWithJoins[]>;
  findById(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null>;
  findByIds(input: { ids: string[]; familiaId: string }): Promise<TemplateTransacao[]>;
  create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao>;
  update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao | null>;
  deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null>;
  reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void>;
}
