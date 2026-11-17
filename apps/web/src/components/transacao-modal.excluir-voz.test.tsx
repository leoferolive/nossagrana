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

    describe('teclado com a confirmação aberta', () => {
      const ativo = () => document.activeElement;
      const teclar = (key: string, shiftKey = false) =>
        fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
      const abrirComTeclado = () => {
        poremCategorias();
        abrir({ onDelete: vi.fn(), transacaoParaEditar: EDICAO });
        maisOpcoes();
        const excluir = chip('Excluir lançamento');
        excluir.focus();
        fireEvent.click(excluir);
        return excluir;
      };

      it('o foco vai para "Cancelar" e o painel de trás fica inerte', () => {
        abrirComTeclado();
        expect(ativo()).toBe(screen.getByRole('button', { name: 'Cancelar' }));
        const confirmacao = screen.getByRole('dialog', { name: 'Excluir lançamento?' });
        const painel = screen.getByRole('button', { name: 'Salvar alterações' });
        expect(painel.closest('[inert]')).not.toBeNull();
        expect(confirmacao.closest('[inert]')).toBeNull();
      });

      it('Tab e Shift+Tab não saem da confirmação: "Salvar alterações" não é alcançado', () => {
        abrirComTeclado();
        const salvar = screen.getByRole('button', { name: 'Salvar alterações' });
        const visitados = new Set<Element | null>();
        for (let i = 0; i < 4; i += 1) {
          teclar('Tab');
          visitados.add(ativo());
        }
        for (let i = 0; i < 4; i += 1) {
          teclar('Tab', true);
          visitados.add(ativo());
        }
        expect(visitados.has(salvar)).toBe(false);
        const confirmacao = screen.getByRole('dialog', { name: 'Excluir lançamento?' });
        visitados.forEach((el) => expect(confirmacao).toContainElement(el as HTMLElement));
      });

      it('Escape cancela só a confirmação e o painel segue aberto', () => {
        abrirComTeclado();
        teclar('Escape');
        expect(
          screen.queryByRole('dialog', { name: 'Excluir lançamento?' }),
        ).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Editar Transação' })).toBeInTheDocument();
      });

      it('ao cancelar, o foco volta ao botão "Excluir lançamento" e o painel deixa de ser inerte', () => {
        const excluir = abrirComTeclado();
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(ativo()).toBe(excluir);
        expect(excluir.closest('[inert]')).toBeNull();
      });

      it('o foco volta ao botão mesmo se o navegador não o focou no clique (Safari)', () => {
        poremCategorias();
        abrir({ onDelete: vi.fn(), transacaoParaEditar: EDICAO });
        maisOpcoes();
        const excluir = chip('Excluir lançamento');
        fireEvent.click(excluir);
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(ativo()).toBe(excluir);
      });
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
