import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { TransacaoModal } from './transacao-modal';

afterEach(() => {
  cleanup();
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
});

const CATEGORIAS = [
  {
    id: 'c1',
    nome: 'Mercado',
    tipo: 'despesa' as const,
    ativo: true,
    familiaId: 'f1',
    criadoPor: 'u1',
    criadoEm: '2026-01-01',
  },
  {
    id: 'c2',
    nome: 'Salario',
    tipo: 'receita' as const,
    ativo: true,
    familiaId: 'f1',
    criadoPor: 'u1',
    criadoEm: '2026-01-01',
  },
];

const METODOS = [
  {
    id: 'm1',
    nome: 'Nubank',
    tipo: 'credito' as const,
    dataFechamento: 15,
    dataVencimento: 22,
    usuarioDonoId: 'u1',
    ativo: true,
    familiaId: 'f1',
    criadoEm: '2026-01-01',
  },
];

describe('TransacaoModal', () => {
  it('não renderiza quando fechado', () => {
    render(<TransacaoModal open={false} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza campos quando aberto', () => {
    useCategoriaStore.setState({ categorias: CATEGORIAS, carregando: false, erro: null });
    render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/valor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/categoria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data/i)).toBeInTheDocument();
  });

  it('toggle entre receita e despesa', () => {
    render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    const receitaBtn = screen.getByRole('button', { name: /receita/i });

    fireEvent.click(receitaBtn);
    expect(receitaBtn.className).toContain('success');
  });

  it('exibe campos de parcelamento ao ativar toggle', () => {
    render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /parcelado/i }));
    expect(screen.getByLabelText(/parcelas/i)).toBeInTheDocument();
  });

  it('exibe campos de recorrência ao ativar toggle', () => {
    render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /recorrente/i }));
    expect(screen.getByLabelText(/frequência/i)).toBeInTheDocument();
  });

  it('chama onClose ao clicar em cancelar', () => {
    const onClose = vi.fn();
    render(<TransacaoModal open={true} familiaId="f1" onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('exibe lista de métodos de pagamento no select', () => {
    useMetodoPagamentoStore.setState({ metodos: METODOS, carregando: false, erro: null });
    render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    // Open the custom select dropdown
    fireEvent.click(screen.getByRole('combobox', { name: /método de pagamento/i }));
    expect(screen.getByText('Nubank')).toBeInTheDocument();
  });
});
