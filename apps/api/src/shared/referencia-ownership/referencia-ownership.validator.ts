import type {
  EntidadeReferenciada,
  MotivoReferenciaInvalida,
  ReferenciaEsperada,
  ReferenciaOwnershipChecker,
  ReferenciaOwnershipRepository,
  ReferenciasFinanceiras,
  TipoLancamento,
} from './referencia-ownership.types.js';

const ROTULO: Record<EntidadeReferenciada, string> = {
  categoria: 'categoria',
  metodoPagamento: 'método de pagamento',
  cofrinho: 'cofrinho',
};

/**
 * Referência financeira que não pertence à família ativa, está inativa ou tem
 * tipo incompatível. Serializado como 422 `{ error: { message, code } }` por
 * `registrarRespostaReferenciaInvalida`, sem catch específico em cada rota;
 * `statusCode` mantém o 422 mesmo se o handler não estiver registrado.
 */
export class ReferenciaInvalidaError extends Error {
  readonly statusCode = 422;
  readonly code = 'REFERENCIA_INVALIDA';

  constructor(
    readonly entidade: EntidadeReferenciada,
    readonly motivo: MotivoReferenciaInvalida,
    message: string,
  ) {
    super(message);
    this.name = 'ReferenciaInvalidaError';
  }
}

/**
 * Monta a expectativa para um ID recebido do cliente. Vínculo novo ou alterado
 * precisa estar ativo; o mesmo vínculo já gravado pode continuar inativo.
 *
 * @example referenciaEsperada(payload.categoriaId, existente.categoriaId)
 */
export function referenciaEsperada(
  id: string | null | undefined,
  idAtual?: string | null,
): ReferenciaEsperada | undefined {
  if (!id) return undefined;
  return { id, exigirAtiva: id !== idAtual };
}

/**
 * Garante que categoria, método de pagamento e cofrinho citados numa mutação
 * pertencem à família ativa (issue #55). Registro de outra família recebe a
 * mesma resposta que um ID inexistente, para não vazar sua existência.
 */
export class ReferenciaOwnershipValidator implements ReferenciaOwnershipChecker {
  constructor(private readonly repository: ReferenciaOwnershipRepository) {}

  async validar(referencias: ReferenciasFinanceiras): Promise<void> {
    const { familiaId, categoria, metodoPagamento, cofrinho } = referencias;
    if (categoria) await this.validarCategoria(familiaId, categoria);
    if (metodoPagamento) {
      const found = await this.repository.findMetodoPagamento({ familiaId, ...metodoPagamento });
      exigirExistenteEAtiva('metodoPagamento', familiaId, metodoPagamento, found);
    }
    if (cofrinho) {
      const found = await this.repository.findCofrinho({ familiaId, ...cofrinho });
      exigirExistenteEAtiva('cofrinho', familiaId, cofrinho, found);
    }
  }

  private async validarCategoria(
    familiaId: string,
    esperada: ReferenciaEsperada & { tipo?: TipoLancamento },
  ): Promise<void> {
    const found = await this.repository.findCategoria({ familiaId, id: esperada.id });
    exigirExistenteEAtiva('categoria', familiaId, esperada, found);
    if (esperada.tipo && found && found.tipo !== esperada.tipo) {
      throw new ReferenciaInvalidaError(
        'categoria',
        'tipo_incompativel',
        `Categoria incompatível: recebido "${esperada.id}" do tipo ${found.tipo}, esperado uma categoria de ${esperada.tipo}`,
      );
    }
  }
}

function exigirExistenteEAtiva(
  entidade: EntidadeReferenciada,
  familiaId: string,
  esperada: ReferenciaEsperada,
  found: { ativo: boolean } | null,
): void {
  const rotulo = ROTULO[entidade];
  if (!found) {
    throw new ReferenciaInvalidaError(
      entidade,
      'nao_encontrada',
      `Referência inválida (${rotulo}): recebido "${esperada.id}", esperado um ID de ${rotulo} existente na família ${familiaId}`,
    );
  }
  if (esperada.exigirAtiva && !found.ativo) {
    throw new ReferenciaInvalidaError(
      entidade,
      'inativa',
      `Referência inativa (${rotulo}): recebido "${esperada.id}", esperado ${rotulo} ativo(a) na família ${familiaId}`,
    );
  }
}
