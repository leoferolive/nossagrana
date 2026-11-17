import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { transacaoService } from '@/services/core-financeiro.service';
import { transacaoDeTeste } from '@/test/fabricas-transacao';
import {
  configurarPainelDeTeste,
  OITO_DESPESAS,
  poremCategorias,
  abrir,
  digitarValor,
  chip,
  maisOpcoes,
  nomesDosChips,
  EDICAO,
} from '@/test/painel-de-lancar';

vi.mock(
  '@/services/core-financeiro.service',
  async () => (await import('@/test/servicos-financeiros-falsos')).servicosFinanceirosFalsos,
);

configurarPainelDeTeste();

describe('TransacaoModal', () => {
  describe('categoria em chips', () => {
    it('mostra só categorias do tipo; trocar o tipo troca os chips', () => {
      poremCategorias();
      abrir();
      expect(nomesDosChips('Categoria')).toEqual(['Mercado', 'Todas']);

      fireEvent.click(chip('Receita'));
      expect(nomesDosChips('Categoria')).toEqual(['Salario', 'Todas']);
    });

    it('limita a seis chips e o "Todas" abre a lista completa', () => {
      poremCategorias(OITO_DESPESAS);
      const { onSubmit } = abrir();
      expect(nomesDosChips('Categoria')).toHaveLength(7);

      fireEvent.click(chip('Todas'));
      const lista = screen.getByRole('dialog', { name: 'Todas as categorias' });
      fireEvent.click(within(lista).getByRole('button', { name: 'Pets' }));
      expect(chip('Pets')).toHaveAttribute('aria-pressed', 'true');

      digitarValor('5');
      fireEvent.click(chip('Salvar despesa'));
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ categoriaId: 'd8' }));
    });

    it('ordena os chips pelas categorias mais usadas nos últimos meses', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
      poremCategorias(OITO_DESPESAS);
      const recentes = ['d8', 'd8', 'd8', 'd7', 'd7', 'd3'].map((categoriaId, i) =>
        transacaoDeTeste({ id: `r${i}`, categoriaId, data: `2026-11-${10 + i}` }),
      );
      vi.mocked(transacaoService.listar).mockImplementation(async ({ mesReferencia }) => ({
        transacoes: mesReferencia === '2026-11' ? recentes : [],
      }));
      abrir();

      await waitFor(() =>
        expect(nomesDosChips('Categoria').slice(0, 3)).toEqual(['Pets', 'Viagem', 'Saúde']),
      );
    });

    it('limpa a categoria escolhida ao trocar para um tipo incompatível', () => {
      poremCategorias();
      const { onSubmit } = abrir();

      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Receita'));
      fireEvent.click(chip('Despesa'));

      expect(chip('Mercado')).toHaveAttribute('aria-pressed', 'false');
      digitarValor('5');
      expect(chip('Salvar despesa')).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('edição de categoria fora das seis mostra a categoria dela selecionada', () => {
      poremCategorias(OITO_DESPESAS);
      abrir({ transacaoParaEditar: { ...EDICAO, categoriaId: 'd8' } });

      expect(nomesDosChips('Categoria')).toContain('Pets');
      expect(chip('Pets')).toHaveAttribute('aria-pressed', 'true');
    });

    it('edição mantém a categoria atual e envia o tipo e o id', () => {
      poremCategorias();
      const onUpdate = vi.fn();
      abrir({
        onUpdate,
        transacaoParaEditar: { ...EDICAO, tipo: 'receita', valor: '5000', categoriaId: 'c2' },
      });

      expect(chip('Salario')).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(chip('Salvar alterações'));
      expect(onUpdate).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ tipo: 'receita', categoriaId: 'c2' }),
      );
    });

    describe('categoria inativa na edição', () => {
      const INATIVA = { ...EDICAO, categoriaId: 'c-inativa' };

      it('aparece selecionada como "Categoria inativa" e reenvia o mesmo id', () => {
        poremCategorias();
        const onUpdate = vi.fn();
        abrir({ onUpdate, transacaoParaEditar: INATIVA });

        expect(chip('Categoria inativa')).toHaveAttribute('aria-pressed', 'true');
        maisOpcoes();
        fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Ajuste' } });
        fireEvent.click(chip('Salvar alterações'));
        expect(onUpdate).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ categoriaId: 'c-inativa', descricao: 'Ajuste' }),
        );
      });

      it('trocar o tipo descarta a categoria inativa até escolher outra', () => {
        poremCategorias();
        const onUpdate = vi.fn();
        abrir({ onUpdate, transacaoParaEditar: INATIVA });

        fireEvent.click(chip('Receita'));
        expect(nomesDosChips('Categoria')).toEqual(['Salario', 'Todas']);
        expect(chip('Salvar alterações')).toBeDisabled();

        fireEvent.click(chip('Salario'));
        fireEvent.click(chip('Salvar alterações'));
        expect(onUpdate).toHaveBeenCalledWith(
          't1',
          expect.objectContaining({ tipo: 'receita', categoriaId: 'c2' }),
        );
      });

      it('voltar ao tipo original reoferece a inativa em "Todas", sem selecioná-la', () => {
        poremCategorias();
        abrir({ onUpdate: vi.fn(), transacaoParaEditar: INATIVA });

        fireEvent.click(chip('Receita'));
        fireEvent.click(chip('Despesa'));

        expect(chip('Salvar alterações')).toBeDisabled();
        fireEvent.click(chip('Todas'));
        const lista = screen.getByRole('dialog', { name: 'Todas as categorias' });
        expect(within(lista).getByRole('button', { name: 'Categoria inativa' })).toHaveAttribute(
          'aria-pressed',
          'false',
        );
      });

      it('clicar no tipo já ativo não descarta a categoria inativa', () => {
        poremCategorias();
        abrir({ onUpdate: vi.fn(), transacaoParaEditar: INATIVA });

        fireEvent.click(chip('Despesa'));
        expect(chip('Categoria inativa')).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('criação não oferece categoria inativa', () => {
      poremCategorias();
      abrir();
      expect(screen.queryByRole('button', { name: 'Categoria inativa' })).not.toBeInTheDocument();
    });
  });
});
