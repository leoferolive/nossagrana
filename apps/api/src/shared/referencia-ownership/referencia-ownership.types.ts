export type TipoLancamento = 'receita' | 'despesa';

/** `transacao`: pai de parcela/recorrência ou transação de uma movimentação de cofrinho. */
export type EntidadeReferenciada = 'categoria' | 'metodoPagamento' | 'cofrinho' | 'transacao';

export type MotivoReferenciaInvalida = 'nao_encontrada' | 'inativa' | 'tipo_incompativel';

export interface CategoriaReferenciada {
  id: string;
  tipo: TipoLancamento;
  ativo: boolean;
}

export interface MetodoPagamentoReferenciado {
  id: string;
  ativo: boolean;
}

/** `ativo` = cofrinho com status `ativo` (não encerrado). */
export interface CofrinhoReferenciado {
  id: string;
  ativo: boolean;
}

interface BuscaPorFamilia {
  familiaId: string;
  id: string;
}

/** Busca sempre restrita à família: registro de outra família é indistinguível de inexistente. */
export interface ReferenciaOwnershipRepository {
  findCategoria(input: BuscaPorFamilia): Promise<CategoriaReferenciada | null>;
  findMetodoPagamento(input: BuscaPorFamilia): Promise<MetodoPagamentoReferenciado | null>;
  findCofrinho(input: BuscaPorFamilia): Promise<CofrinhoReferenciado | null>;
}

/**
 * `exigirAtiva: false` só para vínculo já gravado e inalterado (ex.: editar a
 * descrição de uma transação cuja categoria foi desativada depois).
 */
export interface ReferenciaEsperada {
  id: string;
  exigirAtiva: boolean;
}

export interface ReferenciasFinanceiras {
  familiaId: string;
  categoria?: ReferenciaEsperada & { tipo?: TipoLancamento };
  metodoPagamento?: ReferenciaEsperada;
  cofrinho?: ReferenciaEsperada;
}

/** Contrato consumido pelos services antes de qualquer mutação financeira. */
export interface ReferenciaOwnershipChecker {
  validar(referencias: ReferenciasFinanceiras): Promise<void>;
}
