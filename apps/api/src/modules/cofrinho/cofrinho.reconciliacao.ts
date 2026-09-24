import { deCentavos, paraCentavos } from './cofrinho.centavos.js';
import type { Cofrinho, MovimentacaoCofrinho } from './cofrinho.types.js';

interface ReconciliacaoSaldo {
  saldoMaterializado: string;
  saldoLedger: string;
  consistente: boolean;
}

/**
 * O saldo materializado é otimização (#61): tem de ser sempre igual a
 * Σ aportes − Σ retiradas do ledger. A mesma regra, em SQL somente leitura,
 * está em `db/diagnostics/reconciliacao-cofrinhos.sql`.
 *
 * @example reconciliarSaldo(cofrinho, movimentacoes).consistente // true
 */
export function reconciliarSaldo(
  cofrinho: Pick<Cofrinho, 'saldoAtual'>,
  movimentacoes: Array<Pick<MovimentacaoCofrinho, 'tipo' | 'valor'>>,
): ReconciliacaoSaldo {
  const ledger = movimentacoes.reduce(
    (total, m) => total + (m.tipo === 'aporte' ? 1 : -1) * paraCentavos(m.valor),
    0,
  );
  const materializado = paraCentavos(cofrinho.saldoAtual);
  return {
    saldoMaterializado: deCentavos(materializado),
    saldoLedger: deCentavos(ledger),
    consistente: materializado === ledger,
  };
}
