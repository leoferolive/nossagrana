import { describe, expect, it } from 'vitest';

import { reconciliarSaldo } from './cofrinho.reconciliacao.js';

const aporte = (valor: string) => ({ tipo: 'aporte' as const, valor });
const retirada = (valor: string) => ({ tipo: 'retirada' as const, valor });

describe('reconciliarSaldo', () => {
  it('saldo materializado igual a aportes − retiradas é consistente', () => {
    const resultado = reconciliarSaldo({ saldoAtual: '70.10' }, [
      aporte('100.00'),
      aporte('0.10'),
      retirada('30.00'),
    ]);

    expect(resultado).toEqual({
      saldoMaterializado: '70.10',
      saldoLedger: '70.10',
      consistente: true,
    });
  });

  it('cofrinho sem movimentação e saldo 0 é consistente', () => {
    expect(reconciliarSaldo({ saldoAtual: '0' }, []).consistente).toBe(true);
  });

  it('divergência (ex.: movimentação sem saldo correspondente) é detectada', () => {
    const resultado = reconciliarSaldo({ saldoAtual: '0.00' }, [aporte('50.00')]);

    expect(resultado.consistente).toBe(false);
    expect(resultado.saldoLedger).toBe('50.00');
  });
});
