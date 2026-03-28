/**
 * Templates padrão criados para toda nova família.
 * Conjunto enxuto com itens comuns a qualquer família brasileira.
 * A família pode editar/desativar/adicionar mais depois.
 */

interface TemplatePadrao {
  nome: string;
  tipo: 'receita' | 'despesa';
  /** Nome da categoria padrão (deve existir em categorias-padrao.ts) */
  categoria: string;
  ordem: number;
}

export const TEMPLATES_PADRAO: TemplatePadrao[] = [
  // --- Receitas ---
  { nome: 'Salário', tipo: 'receita', categoria: 'Salario', ordem: 0 },
  { nome: 'Renda Extra', tipo: 'receita', categoria: 'Outros', ordem: 1 },

  // --- Moradia ---
  { nome: 'Aluguel / Financiamento', tipo: 'despesa', categoria: 'Moradia', ordem: 2 },
  { nome: 'Condomínio', tipo: 'despesa', categoria: 'Moradia', ordem: 3 },
  { nome: 'Luz', tipo: 'despesa', categoria: 'Moradia', ordem: 4 },
  { nome: 'Água', tipo: 'despesa', categoria: 'Moradia', ordem: 5 },
  { nome: 'Gás', tipo: 'despesa', categoria: 'Moradia', ordem: 6 },
  { nome: 'Internet', tipo: 'despesa', categoria: 'Moradia', ordem: 7 },

  // --- Alimentação ---
  { nome: 'Supermercado', tipo: 'despesa', categoria: 'Alimentacao', ordem: 8 },

  // --- Transporte ---
  { nome: 'Combustível', tipo: 'despesa', categoria: 'Transporte', ordem: 9 },
  { nome: 'Transporte / Uber', tipo: 'despesa', categoria: 'Transporte', ordem: 10 },
  { nome: 'Estacionamento', tipo: 'despesa', categoria: 'Transporte', ordem: 11 },

  // --- Saúde ---
  { nome: 'Plano de Saúde', tipo: 'despesa', categoria: 'Saude', ordem: 12 },
  { nome: 'Medicamentos', tipo: 'despesa', categoria: 'Saude', ordem: 13 },

  // --- Educação ---
  { nome: 'Escola / Faculdade', tipo: 'despesa', categoria: 'Educacao', ordem: 14 },

  // --- Assinaturas ---
  { nome: 'Celular', tipo: 'despesa', categoria: 'Assinaturas', ordem: 15 },
  { nome: 'Streaming', tipo: 'despesa', categoria: 'Assinaturas', ordem: 16 },

  // --- Lazer ---
  { nome: 'Lazer / Passeios', tipo: 'despesa', categoria: 'Lazer', ordem: 17 },

  // --- Compras ---
  { nome: 'Compras Pessoais', tipo: 'despesa', categoria: 'Compras', ordem: 18 },
];
