import type { TransacaoListResponse } from '@nossagrana/types';
import { describe, expect, it } from 'vitest';

import {
  agruparPorDia,
  formatarComSinal,
  montarCsv,
  nomeDoMes,
  paraCentavos,
  resumoDoPeriodo,
  rotuloDoDia,
  valorAssinadoCentavos,
} from './extrato';

type Transacao = TransacaoListResponse['transacoes'][number];

const T = (id: string, data: string, valor: string, tipo: 'receita' | 'despesa'): Transacao =>
  ({ id, data, valor, tipo }) as Transacao;

describe('paraCentavos', () => {
  it('converte o valor da API em centavos inteiros', () => {
    expect(paraCentavos('129.90')).toBe(12990);
    expect(paraCentavos('5000.00')).toBe(500000);
    expect(paraCentavos('0.07')).toBe(7);
  });

  it('não acumula erro de ponto flutuante', () => {
    expect(paraCentavos('0.10') + paraCentavos('0.20')).toBe(30);
    expect(paraCentavos('1.15')).toBe(115);
  });
});

describe('agruparPorDia', () => {
  it('agrupa do dia mais recente para o mais antigo, mantendo a ordem dentro do dia', () => {
    const dias = agruparPorDia([
      T('a', '2026-11-10', '10.00', 'despesa'),
      T('b', '2026-11-15', '20.00', 'despesa'),
      T('c', '2026-11-10', '30.00', 'despesa'),
      T('d', '2026-11-12', '40.00', 'despesa'),
    ]);
    expect(dias.map((d) => d.data)).toEqual(['2026-11-15', '2026-11-12', '2026-11-10']);
    expect(dias[2].transacoes.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('o total do dia é entradas menos saídas, em centavos', () => {
    const [dia] = agruparPorDia([
      T('a', '2026-11-10', '100.10', 'receita'),
      T('b', '2026-11-10', '0.20', 'despesa'),
      T('c', '2026-11-10', '40.00', 'despesa'),
    ]);
    expect(dia.totalCentavos).toBe(10010 - 20 - 4000);
  });

  it('lista vazia não gera dias', () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});

describe('rotuloDoDia', () => {
  it('hoje: "Hoje · dia da semana minúsculo, dia e mês"', () => {
    expect(rotuloDoDia('2026-11-16', '2026-11-16')).toBe('Hoje · seg, 16 nov');
  });

  it('ontem', () => {
    expect(rotuloDoDia('2026-11-15', '2026-11-16')).toBe('Ontem · dom, 15 nov');
  });

  it('outro dia: primeira letra maiúscula, sem zero à esquerda e sem ponto', () => {
    expect(rotuloDoDia('2026-11-13', '2026-11-16')).toBe('Sex, 13 nov');
    expect(rotuloDoDia('2026-09-05', '2026-11-16')).toBe('Sáb, 5 set');
  });

  it('virada de ano: 31/12 é "Ontem" em 01/01', () => {
    expect(rotuloDoDia('2026-12-31', '2027-01-01')).toBe('Ontem · qui, 31 dez');
  });
});

describe('resumoDoPeriodo', () => {
  it('soma entradas, saídas e saldo em centavos', () => {
    expect(
      resumoDoPeriodo([
        T('a', '2026-11-10', '5000.00', 'receita'),
        T('b', '2026-11-10', '150.50', 'despesa'),
        T('c', '2026-11-11', '0.10', 'despesa'),
        T('d', '2026-11-11', '0.20', 'despesa'),
      ]),
    ).toEqual({ entradasCentavos: 500000, saidasCentavos: 15080, saldoCentavos: 484920 });
  });

  it('saldo negativo quando saem mais do que entra', () => {
    const resumo = resumoDoPeriodo([T('a', '2026-11-10', '80.00', 'despesa')]);
    expect(resumo.saldoCentavos).toBe(-8000);
  });

  it('sem lançamentos tudo é zero', () => {
    expect(resumoDoPeriodo([])).toEqual({
      entradasCentavos: 0,
      saidasCentavos: 0,
      saldoCentavos: 0,
    });
  });
});

describe('formatarComSinal', () => {
  it('entrada leva "+", saída leva "−" e zero fica sem sinal', () => {
    expect(formatarComSinal(500000)).toBe('+R$\u00a05.000,00');
    expect(formatarComSinal(-15050)).toBe('\u2212R$\u00a0150,50');
    expect(formatarComSinal(0)).toBe('R$\u00a00,00');
  });
});

describe('valorAssinadoCentavos', () => {
  it('receita positiva, despesa negativa', () => {
    expect(valorAssinadoCentavos(T('a', '2026-11-10', '12.34', 'receita'))).toBe(1234);
    expect(valorAssinadoCentavos(T('b', '2026-11-10', '12.34', 'despesa'))).toBe(-1234);
  });
});

describe('nomeDoMes', () => {
  it('devolve só o nome do mês, em minúsculo', () => {
    expect(nomeDoMes('2026-11')).toBe('novembro');
    expect(nomeDoMes('2026-03')).toBe('março');
  });
});

describe('montarCsv', () => {
  it('gera o mesmo CSV de sempre: cabeçalho e células entre aspas', () => {
    const csv = montarCsv(
      [
        {
          ...T('a', '2026-11-10', '150.00', 'despesa'),
          descricao: 'Mercado',
          categoriaId: 'c1',
          metodoPagamentoId: 'm1',
        } as Transacao,
        {
          ...T('b', '2026-11-11', '5000.00', 'receita'),
          descricao: null,
          categoriaId: 'c2',
          metodoPagamentoId: null,
        } as Transacao,
      ],
      (id) => (id === 'c1' ? 'Alimentação' : '—'),
      (id) => (id === 'm1' ? 'Pix' : '—'),
    );
    expect(csv).toBe(
      [
        '"Data","Descrição","Categoria","Pagamento","Tipo","Valor"',
        '"2026-11-10","Mercado","Alimentação","Pix","despesa","150.00"',
        '"2026-11-11","","—","—","receita","5000.00"',
      ].join('\n'),
    );
  });
});
