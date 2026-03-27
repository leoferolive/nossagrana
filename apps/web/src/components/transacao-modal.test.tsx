import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import type { DadosVoz } from './transacao-modal';
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

  describe('voice input', () => {
    const dadosVoz: DadosVoz = {
      tipo: 'despesa',
      valor: '42.50',
      categoriaId: 'c1',
      descricao: 'Almoço no restaurante',
      data: '2026-03-20',
    };

    it('pre-fills form from dadosVoz', () => {
      useCategoriaStore.setState({ categorias: CATEGORIAS, carregando: false, erro: null });
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          dadosVoz={dadosVoz}
        />,
      );

      expect(screen.getByLabelText(/valor/i)).toHaveValue(42.5);
      expect(screen.getByLabelText(/descrição/i)).toHaveValue('Almoço no restaurante');
      expect(screen.getByLabelText(/^data$/i)).toHaveValue('2026-03-20');
    });

    it('shows mic button when onVoiceActivate provided', () => {
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onVoiceActivate={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /preencher por voz/i })).toBeInTheDocument();
    });

    it('does NOT show mic button when editing', () => {
      const transacaoParaEditar = {
        id: 't1',
        tipo: 'despesa' as const,
        valor: '100',
        categoriaId: 'c1',
        descricao: 'Teste',
        data: '2026-03-20',
        metodoPagamentoId: null,
      };

      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          transacaoParaEditar={transacaoParaEditar}
          onVoiceActivate={vi.fn()}
        />,
      );

      expect(screen.queryByRole('button', { name: /preencher por voz/i })).not.toBeInTheDocument();
    });

    it('calls onVoiceActivate when mic button clicked', () => {
      const onVoiceActivate = vi.fn();
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onVoiceActivate={onVoiceActivate}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /preencher por voz/i }));
      expect(onVoiceActivate).toHaveBeenCalledOnce();
    });
  });
});
