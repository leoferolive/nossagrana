import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAvisoStore } from '@/stores/aviso.store';
import {
  configurarPainelDeTeste,
  poremCategorias,
  poremMetodos,
  abrir,
  digitarValor,
  chip,
  maisOpcoes,
  nomesDosChips,
  grupo,
  metodo,
  METODOS,
  EDICAO,
} from '@/test/painel-de-lancar';
import { TransacaoModal } from '@/components/transacao-modal';

vi.mock(
  '@/services/core-financeiro.service',
  async () => (await import('@/test/servicos-financeiros-falsos')).servicosFinanceirosFalsos,
);

configurarPainelDeTeste();

describe('TransacaoModal', () => {
  describe('forma de pagamento e parcelas', () => {
    it('um chip por forma ativa; nenhuma escolhida envia metodoPagamentoId nulo', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      expect(nomesDosChips('Pago com')).toEqual(['Nubank', 'Pix']);

      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ metodoPagamentoId: null }));
    });

    describe('forma de pagamento inativa na edição', () => {
      const COM_FORMA = { ...EDICAO, metodoPagamentoId: 'm-velho' };
      const editar = () => {
        const onUpdate = vi.fn();
        abrir({ onUpdate, transacaoParaEditar: COM_FORMA });
        return onUpdate;
      };

      it('sem nenhuma forma ativa, a atual aparece como chip selecionado', () => {
        poremCategorias();
        editar();
        expect(grupo('Pago com')).toBeInTheDocument();
        expect(chip('Forma de pagamento (inativa)')).toHaveAttribute('aria-pressed', 'true');
      });

      it('se a loja tem a forma inativa, o chip leva o nome dela com "(inativo)"', () => {
        poremCategorias();
        poremMetodos([
          ...METODOS,
          { ...metodo('m-velho', 'Cartão antigo', 'credito'), ativo: false },
        ]);
        editar();
        expect(chip('Cartão antigo (inativo)')).toHaveAttribute('aria-pressed', 'true');
        expect(nomesDosChips('Pago com')).toEqual(['Nubank', 'Pix', 'Cartão antigo (inativo)']);
      });

      it('manter envia o mesmo id', () => {
        poremCategorias();
        const onUpdate = editar();
        fireEvent.click(chip('Salvar alterações'));
        expect(onUpdate).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ metodoPagamentoId: 'm-velho' }),
        );
      });

      it('tocar no chip selecionado desmarca e envia metodoPagamentoId nulo', () => {
        poremCategorias();
        const onUpdate = editar();
        fireEvent.click(chip('Forma de pagamento (inativa)'));
        expect(chip('Forma de pagamento (inativa)')).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(chip('Salvar alterações'));
        expect(onUpdate).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ metodoPagamentoId: null }),
        );
      });

      it('lançamento novo não oferece forma inativa', () => {
        poremCategorias();
        poremMetodos([
          ...METODOS,
          { ...metodo('m-velho', 'Cartão antigo', 'credito'), ativo: false },
        ]);
        abrir();
        expect(nomesDosChips('Pago com')).toEqual(['Nubank', 'Pix']);
      });

      it('edição de lançamento sem forma e sem formas ativas não mostra o bloco', () => {
        poremCategorias();
        abrir({ onUpdate: vi.fn(), transacaoParaEditar: EDICAO });
        expect(screen.queryByRole('group', { name: 'Pago com' })).not.toBeInTheDocument();
      });
    });

    it('parcelas só aparecem em "Mais opções" quando a forma é cartão de crédito', () => {
      poremCategorias();
      poremMetodos();
      abrir();
      maisOpcoes();
      expect(screen.queryByRole('button', { name: 'Parcelado' })).not.toBeInTheDocument();

      fireEvent.click(chip('Pix'));
      expect(screen.queryByRole('button', { name: 'Parcelado' })).not.toBeInTheDocument();

      fireEvent.click(chip('Nubank'));
      fireEvent.click(chip('Parcelado'));
      expect(screen.getByLabelText('Parcelas')).toBeInTheDocument();
    });

    it('parcelado no crédito envia o número de parcelas', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      digitarValor('120');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Nubank'));
      maisOpcoes();
      fireEvent.click(chip('Parcelado'));
      fireEvent.change(screen.getByLabelText('Parcelas'), { target: { value: '3' } });
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ parcelado: true, numeroParcelas: 3, metodoPagamentoId: 'm1' }),
      );
    });

    it('trocar a forma para outra que não é crédito desfaz o parcelamento', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      digitarValor('120');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Nubank'));
      maisOpcoes();
      fireEvent.click(chip('Parcelado'));
      fireEvent.click(chip('Pix'));
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          parcelado: false,
          numeroParcelas: null,
          metodoPagamentoId: 'm2',
        }),
      );
    });

    it('repetição envia frequência e data fim', () => {
      poremCategorias();
      const { onSubmit } = abrir();
      digitarValor('50');
      fireEvent.click(chip('Mercado'));
      maisOpcoes();
      fireEvent.click(chip('Recorrente'));
      fireEvent.change(screen.getByLabelText('Data fim recorrência'), {
        target: { value: '2027-06-30' },
      });
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recorrente: true,
          frequencia: 'mensal',
          dataFimRecorrencia: '2027-06-30',
          parcelado: false,
        }),
      );
    });
  });

  describe('salvar', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
    });

    it('envia o mesmo payload de antes para os mesmos dados', () => {
      poremCategorias();
      poremMetodos();
      const { onSubmit } = abrir();
      digitarValor('42.50');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Pix'));
      maisOpcoes();
      fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Feira' } });
      fireEvent.click(chip('Salvar despesa'));

      expect(onSubmit).toHaveBeenCalledWith({
        tipo: 'despesa',
        valor: '42.50',
        categoriaId: 'c1',
        descricao: 'Feira',
        data: '2026-11-17',
        metodoPagamentoId: 'm2',
        parcelado: false,
        numeroParcelas: null,
        recorrente: false,
        frequencia: null,
        dataFimRecorrencia: null,
      });
    });

    it('na edição envia o payload de atualização', () => {
      poremCategorias();
      const onUpdate = vi.fn();
      abrir({ onUpdate, transacaoParaEditar: { ...EDICAO, descricao: 'Antigo' } });
      digitarValor('99');
      fireEvent.click(chip('Salvar alterações'));

      expect(onUpdate).toHaveBeenCalledWith('t1', {
        tipo: 'despesa',
        valor: '99',
        categoriaId: 'c1',
        descricao: 'Antigo',
        data: '2026-03-05',
        metodoPagamentoId: null,
      });
    });

    it('o rótulo do botão acompanha o tipo', () => {
      poremCategorias();
      abrir();
      expect(chip('Salvar despesa')).toBeInTheDocument();
      fireEvent.click(chip('Receita'));
      expect(chip('Salvar receita')).toBeInTheDocument();
    });

    it('sem valor e sem categoria fica desabilitado e escreve os dois motivos', () => {
      poremCategorias();
      const { onSubmit } = abrir();

      const salvar = chip('Salvar despesa');
      expect(salvar).toBeDisabled();
      expect(salvar).toHaveAccessibleDescription(
        'Digite o valor e escolha uma categoria de despesa',
      );
      fireEvent.click(salvar);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('com valor falta só a categoria, e o motivo acompanha o tipo', () => {
      poremCategorias();
      abrir();
      digitarValor('10');
      expect(chip('Salvar despesa')).toHaveAccessibleDescription(
        'Escolha uma categoria de despesa',
      );
      fireEvent.click(chip('Receita'));
      expect(screen.getByText('Escolha uma categoria de receita')).toBeInTheDocument();
    });

    it('valor zero também bloqueia', () => {
      poremCategorias();
      abrir();
      fireEvent.click(chip('Mercado'));
      digitarValor('0');
      expect(chip('Salvar despesa')).toBeDisabled();
      expect(chip('Salvar despesa')).toHaveAccessibleDescription('Digite o valor');
    });

    it('com valor e categoria habilita salvar, sem motivo', () => {
      poremCategorias();
      abrir();
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      expect(chip('Salvar despesa')).toBeEnabled();
      expect(screen.queryByText(/escolha uma categoria/i)).not.toBeInTheDocument();
    });

    it('tocar duas vezes durante a gravação grava uma vez só', async () => {
      poremCategorias();
      let terminar: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((resolve) => (terminar = resolve)));
      abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));

      fireEvent.click(chip('Salvar despesa'));
      fireEvent.click(screen.getByRole('button', { name: /salvando/i }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled();
      await act(async () => terminar());
    });

    it('depois do sucesso o botão segue travado até o painel fechar: um toque na janela não grava de novo', async () => {
      poremCategorias();
      let terminar: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((resolve) => (terminar = resolve)));
      abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      const salvar = chip('Salvar despesa');
      fireEvent.click(salvar);

      // A gravação terminou, mas o painel ainda não fechou (o voltar do histórico é assíncrono).
      await act(async () => terminar());
      fireEvent.click(salvar);

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(salvar).toBeDisabled();
    });

    it('enquanto grava, o X e o fundo não fecham o painel', async () => {
      poremCategorias();
      let terminar: () => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((resolve) => (terminar = resolve)));
      const { onClose } = abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));

      expect(chip('Fechar modal')).toBeDisabled();
      fireEvent.click(chip('Fechar modal'));
      fireEvent.click(screen.getByRole('dialog', { name: 'Nova Transação' }));
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => terminar());
    });

    it('se a gravação falha depois de o painel ter fechado (voltar), o erro vira aviso', async () => {
      poremCategorias();
      let falhar: (erro: Error) => void = () => {};
      const onSubmit = vi.fn(() => new Promise<void>((_, rejeitar) => (falhar = rejeitar)));
      const { rerender } = abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));

      rerender(
        <TransacaoModal open={false} familiaId="f1" onClose={vi.fn()} onSubmit={onSubmit} />,
      );
      await act(async () => falhar(new Error('rede')));

      expect(useAvisoStore.getState().aviso).toMatchObject({
        mensagem: 'Não foi possível salvar. Tente de novo.',
        tom: 'erro',
      });
    });

    it('se gravar falha, mantém o painel aberto, avisa e deixa tentar de novo', async () => {
      poremCategorias();
      const onSubmit = vi
        .fn()
        .mockRejectedValueOnce(new Error('rede'))
        .mockResolvedValue(undefined);
      const { onClose } = abrir({ onSubmit });
      digitarValor('10');
      fireEvent.click(chip('Mercado'));

      fireEvent.click(chip('Salvar despesa'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
      expect(chip('Salvar despesa')).toBeEnabled();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(chip('Salvar despesa'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
  });
});
