import { cleanup, act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransacaoModal } from '@/components/transacao-modal';
import { useAvisoStore } from '@/stores/aviso.store';
import {
  configurarPainelDeTeste,
  poremCategorias,
  poremMetodos,
  abrir,
  digitarValor,
  chip,
  grupo,
  EDICAO,
} from '@/test/painel-de-lancar';

vi.mock(
  '@/services/core-financeiro.service',
  async () => (await import('@/test/servicos-financeiros-falsos')).servicosFinanceirosFalsos,
);

configurarPainelDeTeste();

describe('TransacaoModal', () => {
  it('não renderiza quando fechado', () => {
    abrir({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('é um diálogo com título acessível para nova transação e para edição', () => {
    poremCategorias();
    abrir();
    expect(screen.getByRole('dialog', { name: 'Nova Transação' })).toBeInTheDocument();
    cleanup();

    abrir({ transacaoParaEditar: EDICAO });
    expect(screen.getByRole('dialog', { name: 'Editar Transação' })).toBeInTheDocument();
  });

  it('mostra os blocos na ordem: tipo, valor, categoria, quando, pago com, mais opções, salvar', () => {
    poremCategorias();
    poremMetodos();
    abrir();

    const blocos = [
      chip('Despesa'),
      screen.getByLabelText('Valor'),
      grupo('Categoria'),
      grupo('Quando'),
      grupo('Pago com'),
      chip('Descrição, parcelas e repetição'),
      chip('Salvar despesa'),
    ];
    blocos.slice(1).forEach((bloco, i) => {
      expect(
        blocos[i].compareDocumentPosition(bloco) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('o valor recebe o foco ao abrir uma transação nova, mas não na edição', () => {
    poremCategorias();
    abrir();
    expect(screen.getByLabelText('Valor')).toHaveFocus();
    cleanup();

    abrir({ transacaoParaEditar: EDICAO });
    expect(screen.getByLabelText('Valor')).not.toHaveFocus();
  });

  it('ao abrir o painel o aviso de 6 segundos some, para não ficar por cima dele', () => {
    useAvisoStore.getState().mostrar({ mensagem: 'Despesa lançada', desfazer: async () => {} });
    abrir();
    expect(useAvisoStore.getState().aviso).toBeNull();
  });

  describe('teclado no painel', () => {
    const ativo = () => document.activeElement;
    const teclar = (key: string, shiftKey = false) =>
      fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });

    it('Tab no último foco do painel volta ao primeiro, e Shift+Tab no primeiro vai ao último: o foco não vaza para a tela de trás', () => {
      poremCategorias();
      abrir();
      const salvar = chip('Salvar despesa');
      const primeiro = chip('Despesa');
      // O motivo bloqueia o salvar: o último focável é a linha de "Mais opções".
      const ultimo = chip('Descrição, parcelas e repetição');
      expect(salvar).toBeDisabled();
      ultimo.focus();
      teclar('Tab');
      expect(ativo()).toBe(primeiro);
      teclar('Tab', true);
      expect(ativo()).toBe(ultimo);
    });

    it('Escape fecha o painel', () => {
      const { onClose } = abrir();
      teclar('Escape');
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('ao fechar, o foco volta a quem abriu o painel', () => {
      const props = { familiaId: 'f1', onClose: vi.fn(), onSubmit: vi.fn() };
      const { rerender } = render(
        <>
          <button>abridor</button>
          <TransacaoModal open={false} {...props} />
        </>,
      );
      const abridor = screen.getByRole('button', { name: 'abridor' });
      abridor.focus();
      rerender(
        <>
          <button>abridor</button>
          <TransacaoModal open {...props} />
        </>,
      );
      expect(ativo()).not.toBe(abridor);
      rerender(
        <>
          <button>abridor</button>
          <TransacaoModal open={false} {...props} />
        </>,
      );
      expect(ativo()).toBe(abridor);
    });
  });

  it('o botão de fechar chama onClose', () => {
    const { onClose } = abrir();
    fireEvent.click(chip('Fechar modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('a área visível acompanha o teclado: o painel usa a altura do visualViewport', () => {
    const fake = Object.assign(new EventTarget(), { height: 480, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true });
    try {
      abrir();
      const raiz = screen.getByRole('dialog');
      expect(raiz).toHaveStyle({ height: '480px', top: '0px' });
      act(() => {
        fake.height = 300;
        fake.dispatchEvent(new Event('resize'));
      });
      expect(raiz).toHaveStyle({ height: '300px' });
    } finally {
      Reflect.deleteProperty(window, 'visualViewport');
    }
  });

  it('o rodapé com o botão fica fora da área que rola', () => {
    abrir();
    const salvar = chip('Salvar despesa');
    const rolagem = screen.getByLabelText('Valor').closest('.overflow-y-auto');
    expect(rolagem).not.toBeNull();
    expect(rolagem).not.toContainElement(salvar);
  });

  describe('data', () => {
    beforeEach(() => {
      // Só o Date é falso, para não travar as esperas da Testing Library.
      vi.useFakeTimers({ toFake: ['Date'] });
    });

    const salvarCom = (valor: string) => {
      digitarValor(valor);
      fireEvent.click(chip('Mercado'));
      fireEvent.click(chip('Salvar despesa'));
    };

    it('abre em Hoje com o dia local depois das 21h, e não com o dia seguinte em UTC', () => {
      vi.setSystemTime(new Date('2026-11-15T02:11:00Z')); // 14/11 às 23:11 em São Paulo
      poremCategorias();
      const { onSubmit } = abrir();

      expect(chip('Hoje')).toHaveAttribute('aria-pressed', 'true');
      salvarCom('10');
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ data: '2026-11-14' }));
    });

    it('Ontem em 1º de janeiro é 31 de dezembro do ano anterior', () => {
      vi.setSystemTime(new Date('2027-01-01T15:00:00Z'));
      poremCategorias();
      const { onSubmit } = abrir();

      fireEvent.click(chip('Ontem'));
      salvarCom('10');
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ data: '2026-12-31' }));
    });

    it('Outra data usa a data escolhida no campo', () => {
      vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
      poremCategorias();
      const { onSubmit } = abrir();

      fireEvent.click(chip(/outra data/i));
      fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-05' } });
      salvarCom('10');
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ data: '2026-10-05' }));
    });
  });
});
