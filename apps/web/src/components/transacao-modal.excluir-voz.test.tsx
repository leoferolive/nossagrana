import { cleanup, act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  configurarPainelDeTeste,
  poremCategorias,
  abrir,
  chip,
  maisOpcoes,
  EDICAO,
} from '@/test/painel-de-lancar';
import type { DadosVoz } from '@/components/transacao-modal';

vi.mock(
  '@/services/core-financeiro.service',
  async () => (await import('@/test/servicos-financeiros-falsos')).servicosFinanceirosFalsos,
);

configurarPainelDeTeste();

describe('TransacaoModal', () => {
  describe('excluir', () => {
    const abrirConfirmacao = (onDelete = vi.fn()) => {
      poremCategorias();
      abrir({ onDelete, transacaoParaEditar: EDICAO });
      maisOpcoes();
      fireEvent.click(chip('Excluir lançamento'));
      return onDelete;
    };

    it('fica em "Mais opções" na edição', () => {
      poremCategorias();
      abrir({ onDelete: vi.fn(), transacaoParaEditar: EDICAO });
      expect(screen.queryByRole('button', { name: 'Excluir lançamento' })).not.toBeInTheDocument();
      maisOpcoes();
      expect(chip('Excluir lançamento')).toBeInTheDocument();
    });

    it('abre o painel de confirmação do app, sem window.confirm, e ainda não exclui', () => {
      const confirmar = vi.spyOn(window, 'confirm');
      const onDelete = abrirConfirmacao();

      const painel = screen.getByRole('dialog', { name: 'Excluir lançamento?' });
      // Sem descrição, o nome do lançamento é o da categoria.
      expect(painel).toHaveTextContent('Mercado');
      expect(painel).toHaveTextContent('R$ 80,00');
      expect(confirmar).not.toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
      confirmar.mockRestore();
    });

    it('Cancelar fecha a confirmação e não exclui', () => {
      const onDelete = abrirConfirmacao();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog', { name: 'Excluir lançamento?' })).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('confirmar exclui o lançamento uma vez só', async () => {
      let terminar: () => void = () => {};
      const onDelete = abrirConfirmacao(vi.fn(() => new Promise<void>((r) => (terminar = r))));

      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
      fireEvent.click(screen.getByRole('button', { name: /excluindo/i }));
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith('t1');
      expect(chip('Fechar modal')).toBeDisabled();
      await act(async () => terminar());
    });

    it('se excluir falha, mantém a confirmação aberta e avisa', async () => {
      abrirConfirmacao(vi.fn().mockRejectedValue(new Error('rede')));
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível excluir');
      expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled();
    });
  });

  describe('voz', () => {
    const dadosVoz: DadosVoz = {
      tipo: 'despesa',
      valor: '42.50',
      categoriaId: 'c1',
      descricao: 'Almoço no restaurante',
      data: '2026-03-20',
    };

    it('preenche o painel com o que a voz reconheceu', () => {
      poremCategorias();
      abrir({ dadosVoz });

      expect(screen.getByLabelText('Valor')).toHaveValue(42.5);
      expect(chip('Mercado')).toHaveAttribute('aria-pressed', 'true');
      expect(chip(/outra data/i)).toHaveTextContent('20/03/2026');
      // A descrição reconhecida aparece sem precisar abrir "Mais opções".
      expect(screen.getByLabelText('Descrição')).toHaveValue('Almoço no restaurante');
    });

    it('mostra o microfone ao lado do valor e chama a voz', () => {
      const onVoiceActivate = vi.fn();
      abrir({ onVoiceActivate });
      fireEvent.click(chip('Preencher por voz'));
      expect(onVoiceActivate).toHaveBeenCalledOnce();
    });

    it('não mostra o microfone sem voz disponível nem na edição', () => {
      abrir();
      expect(screen.queryByRole('button', { name: 'Preencher por voz' })).not.toBeInTheDocument();
      cleanup();

      abrir({ transacaoParaEditar: EDICAO, onVoiceActivate: vi.fn() });
      expect(screen.queryByRole('button', { name: 'Preencher por voz' })).not.toBeInTheDocument();
    });

    it('categoria de outro tipo não deixa categoria incoerente', () => {
      poremCategorias();
      const { onSubmit } = abrir({ dadosVoz: { ...dadosVoz, tipo: 'receita', descricao: null } });

      expect(screen.getByRole('button', { name: 'Salario' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(chip('Salvar receita')).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('voz sem dados de data usa hoje', () => {
      poremCategorias();
      abrir({ dadosVoz: { ...dadosVoz, data: null } });
      expect(chip('Hoje')).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
