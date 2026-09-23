import type {
  ReferenciaOwnershipChecker,
  ReferenciasFinanceiras,
} from './referencia-ownership.types.js';

/**
 * Fake para testes cujo foco não é ownership: aceita qualquer referência e
 * registra as chamadas, para o teste ainda poder afirmar que a validação ocorreu.
 * Testes de ownership usam `ReferenciaOwnershipValidator` com o repositório InMemory.
 */
export class ReferenciasSempreValidasFake implements ReferenciaOwnershipChecker {
  readonly chamadas: ReferenciasFinanceiras[] = [];

  async validar(referencias: ReferenciasFinanceiras): Promise<void> {
    this.chamadas.push(referencias);
  }
}
