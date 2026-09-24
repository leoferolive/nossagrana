import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  describe('filtro de categorias por tipo', () => {
    const abrirCategorias = () =>
      fireEvent.click(screen.getByRole('combobox', { name: 'Categoria' }));
    const opcoes = () => screen.getAllByRole('option').map((o) => o.textContent);

    beforeEach(() => {
      useCategoriaStore.setState({ categorias: CATEGORIAS, carregando: false, erro: null });
    });

    it('lista só categorias do tipo selecionado', () => {
      render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);

      abrirCategorias();
      expect(opcoes()).toEqual(['Mercado']);
      abrirCategorias(); // fecha o dropdown (fireEvent.click não dispara mousedown externo)

      fireEvent.click(screen.getByRole('button', { name: 'Receita' }));
      abrirCategorias();
      expect(opcoes()).toEqual(['Salario']);
    });

    it('limpa a categoria escolhida ao trocar para um tipo incompatível', () => {
      const onSubmit = vi.fn();
      render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={onSubmit} />);

      abrirCategorias();
      fireEvent.click(screen.getByRole('option', { name: 'Mercado' }));
      fireEvent.click(screen.getByRole('button', { name: 'Receita' }));
      fireEvent.click(screen.getByRole('button', { name: 'Despesa' }));

      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Selecione...');
      fireEvent.click(screen.getByRole('button', { name: /salvar transação/i }));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: '' }));
    });

    it('edição mantém a categoria atual da transação', () => {
      const onUpdate = vi.fn();
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onUpdate={onUpdate}
          transacaoParaEditar={{
            id: 't1',
            tipo: 'receita',
            valor: '5000',
            categoriaId: 'c2',
            descricao: null,
            data: '2026-03-05',
            metodoPagamentoId: null,
          }}
        />,
      );

      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Salario');
      fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));
      expect(onUpdate).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ tipo: 'receita', categoriaId: 'c2' }),
      );
    });

    const TRANSACAO_CATEGORIA_INATIVA = {
      id: 't1',
      tipo: 'despesa' as const,
      valor: '80',
      categoriaId: 'c-inativa',
      descricao: null,
      data: '2026-03-05',
      metodoPagamentoId: null,
    };

    it('edição com categoria fora da lista (inativa) reenvia o mesmo id', () => {
      const onUpdate = vi.fn();
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onUpdate={onUpdate}
          transacaoParaEditar={TRANSACAO_CATEGORIA_INATIVA}
        />,
      );

      fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Ajuste' } });
      fireEvent.click(screen.getByRole('button', { name: /salvar alterações/i }));
      expect(onUpdate).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ categoriaId: 'c-inativa', descricao: 'Ajuste' }),
      );
    });

    it('edição exibe a categoria inativa atual no seletor', () => {
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          onUpdate={vi.fn()}
          transacaoParaEditar={TRANSACAO_CATEGORIA_INATIVA}
        />,
      );

      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent(
        'Categoria inativa',
      );
    });

    it('criação não oferece categoria inativa', () => {
      render(<TransacaoModal open={true} familiaId="f1" onClose={vi.fn()} onSubmit={vi.fn()} />);

      abrirCategorias();
      expect(opcoes()).not.toContain('Categoria inativa');
    });

    it('voz com categoria de outro tipo não deixa categoria incoerente', () => {
      const onSubmit = vi.fn();
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={onSubmit}
          dadosVoz={{
            tipo: 'receita',
            valor: '100',
            categoriaId: 'c1',
            descricao: null,
            data: '2026-03-20',
          }}
        />,
      );

      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Selecione...');
      fireEvent.click(screen.getByRole('button', { name: /salvar transação/i }));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'receita', categoriaId: '' }),
      );
    });

    it('voz com categoria do mesmo tipo mantém a seleção', () => {
      render(
        <TransacaoModal
          open={true}
          familiaId="f1"
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          dadosVoz={{
            tipo: 'despesa',
            valor: '42',
            categoriaId: 'c1',
            descricao: null,
            data: '2026-03-20',
          }}
        />,
      );

      expect(screen.getByRole('combobox', { name: 'Categoria' })).toHaveTextContent('Mercado');
    });
  });
});
