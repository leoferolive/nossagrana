import type { TransacaoListResponse } from '@nossagrana/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LinhaDeLancamento } from './linha-de-lancamento';

type Transacao = TransacaoListResponse['transacoes'][number];

afterEach(cleanup);

const T = (extra: Partial<Transacao> = {}): Transacao =>
  ({
    id: 't1',
    tipo: 'despesa',
    valor: '150.00',
    descricao: 'Mercado do mês',
    data: '2026-11-10',
    parcelado: false,
    parcelaAtual: null,
    numeroParcelas: null,
    recorrente: false,
    ...extra,
  }) as Transacao;

const montar = (t: Transacao, categoria = 'Alimentação', metodo: string | null = 'Pix') => {
  const onAbrir = vi.fn();
  render(
    <ul>
      <LinhaDeLancamento
        transacao={t}
        categoriaNome={categoria}
        metodoNome={metodo}
        onAbrir={onAbrir}
      />
    </ul>,
  );
  return onAbrir;
};

describe('LinhaDeLancamento', () => {
  it('é um botão de no mínimo 52px com nome que inclui descrição e valor', () => {
    montar(T());
    const linha = screen.getByRole('button', { name: /Mercado do mês.*R\$\s*150,00/ });
    expect(linha).toHaveClass('min-h-[52px]');
  });

  it('o título é a descrição; sem descrição, o nome da categoria', () => {
    montar(T({ descricao: null }), 'Saúde');
    expect(screen.getAllByText('Saúde').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Saúde/ })).toBeInTheDocument();
  });

  it('metadado "Categoria · Forma de pagamento"', () => {
    montar(T());
    expect(screen.getByText('Alimentação · Pix')).toBeInTheDocument();
  });

  it('sem forma de pagamento mostra só a categoria', () => {
    montar(T(), 'Alimentação', null);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
  });

  it('parcela acrescenta "· 3/10"', () => {
    montar(T({ parcelado: true, parcelaAtual: 3, numeroParcelas: 10 }));
    expect(screen.getByText('Alimentação · Pix · 3/10')).toBeInTheDocument();
  });

  it('recorrente acrescenta "· Recorrente"', () => {
    montar(T({ recorrente: true }));
    expect(screen.getByText('Alimentação · Pix · Recorrente')).toBeInTheDocument();
  });

  it('saída neutra com "−"; entrada verde com "+"', () => {
    montar(T());
    expect(screen.getByText(/−R\$\s*150,00/)).toHaveClass('text-text');
    cleanup();
    montar(T({ tipo: 'receita', valor: '5000.00' }));
    expect(screen.getByText(/\+R\$\s*5\.000,00/)).toHaveClass('text-success');
  });

  it('tocar na linha chama onAbrir com a transação', () => {
    const t = T();
    const onAbrir = montar(t);
    fireEvent.click(screen.getByRole('button'));
    expect(onAbrir).toHaveBeenCalledWith(t);
  });
});
