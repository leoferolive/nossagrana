import type { TransacaoCreateRequest } from '@nossagrana/types';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transacaoService } from '@/services/core-financeiro.service';
import { useAvisoStore } from '@/stores/aviso.store';
import { useTransacaoStore } from '@/stores/transacao.store';

import { useLancamento } from './use-lancamento';

vi.mock('@/services/core-financeiro.service', () => ({
  transacaoService: {
    registrar: vi.fn(),
    editar: vi.fn(),
    excluir: vi.fn(),
  },
}));

const payload = {
  tipo: 'despesa' as const,
  valor: '10.00',
  categoriaId: 'cat-1',
  data: '2026-11-10',
  parcelado: false,
  recorrente: false,
};
const edicao = {
  tipo: 'despesa' as const,
  valor: '10.00',
  categoriaId: 'cat-1',
  data: '2026-11-10',
};

const Roteador = ({ children }: { children: ReactNode }) => (
  <MemoryRouter initialEntries={['/extrato']}>{children}</MemoryRouter>
);

const montar = () => renderHook(() => useLancamento('fam-1'), { wrapper: Roteador });
const versao = () => useTransacaoStore.getState().versao;

describe('useLancamento > sinal de mudança', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useTransacaoStore.setState({ versao: 0 });
  });

  it('registrar com sucesso sinaliza a mudança', async () => {
    vi.mocked(transacaoService.registrar).mockResolvedValue({ transacao: { id: 't' } } as never);
    const { result } = montar();
    await act(() => Promise.resolve(result.current.modal.onSubmit(payload)));
    expect(versao()).toBe(1);
  });

  it('atualizar com sucesso sinaliza a mudança', async () => {
    vi.mocked(transacaoService.editar).mockResolvedValue({ transacao: { id: 't' } } as never);
    const { result } = montar();
    await act(() => Promise.resolve(result.current.modal.onUpdate?.('t', edicao)));
    expect(versao()).toBe(1);
  });

  it('excluir com sucesso sinaliza a mudança', async () => {
    vi.mocked(transacaoService.excluir).mockResolvedValue(undefined as never);
    const { result } = montar();
    await act(() => Promise.resolve(result.current.modal.onDelete?.('t')));
    expect(versao()).toBe(1);
  });

  it.each([
    ['registrar', () => vi.mocked(transacaoService.registrar)],
    ['editar', () => vi.mocked(transacaoService.editar)],
    ['excluir', () => vi.mocked(transacaoService.excluir)],
  ])('falha ao %s não sinaliza', async (nome, servico) => {
    servico().mockRejectedValue(new Error('falhou'));
    const { result } = montar();
    const chamada =
      nome === 'registrar'
        ? result.current.modal.onSubmit(payload)
        : nome === 'editar'
          ? result.current.modal.onUpdate?.('t', edicao)
          : result.current.modal.onDelete?.('t');
    await act(() => Promise.resolve(chamada).catch(() => undefined));
    expect(versao()).toBe(0);
  });
});

describe('useLancamento > aviso depois de gravar', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useTransacaoStore.setState({ versao: 0 });
    useAvisoStore.getState().fechar();
  });

  const aviso = () => useAvisoStore.getState().aviso;
  const registrarCom = async (extra: Partial<TransacaoCreateRequest> = {}, id = 'novo-1') => {
    vi.mocked(transacaoService.registrar).mockResolvedValue({ transacao: { id } } as never);
    const { result } = montar();
    await act(() => Promise.resolve(result.current.modal.onSubmit({ ...payload, ...extra })));
  };

  it('despesa lançada vem com "Desfazer"', async () => {
    await registrarCom();
    expect(aviso()?.mensagem).toBe('Despesa lançada');
    expect(aviso()?.desfazer).toBeDefined();
  });

  it('receita lançada', async () => {
    await registrarCom({ tipo: 'receita' });
    expect(aviso()?.mensagem).toBe('Receita lançada');
  });

  it('lançamento parcelado não oferece "Desfazer"', async () => {
    await registrarCom({ parcelado: true, numeroParcelas: 3 });
    expect(aviso()?.mensagem).toBe('Despesa lançada');
    expect(aviso()?.desfazer).toBeUndefined();
  });

  it('lançamento recorrente não oferece "Desfazer"', async () => {
    await registrarCom({ recorrente: true, frequencia: 'mensal' });
    expect(aviso()?.desfazer).toBeUndefined();
  });

  it('desfazer exclui o lançamento recém-criado, uma vez só, e sinaliza o Extrato', async () => {
    vi.mocked(transacaoService.excluir).mockResolvedValue(undefined as never);
    await registrarCom({}, 'novo-42');
    const desfazer = aviso()?.desfazer;
    const antes = versao();

    await act(async () => {
      await Promise.all([desfazer?.(), desfazer?.()]);
    });

    expect(transacaoService.excluir).toHaveBeenCalledTimes(1);
    expect(transacaoService.excluir).toHaveBeenCalledWith('novo-42', 'fam-1');
    expect(versao()).toBe(antes + 1);
    expect(aviso()?.mensagem).toBe('Lançamento desfeito');
    expect(aviso()?.desfazer).toBeUndefined();
  });

  it('se desfazer falha, avisa em tom de erro', async () => {
    vi.mocked(transacaoService.excluir).mockRejectedValue(new Error('rede'));
    await registrarCom();
    await act(async () => aviso()?.desfazer?.());
    expect(aviso()?.mensagem).toBe('Não foi possível desfazer');
    expect(aviso()?.tom).toBe('erro');
  });

  it('desfazer ainda funciona depois de o painel e a tela terem desmontado', async () => {
    vi.mocked(transacaoService.excluir).mockResolvedValue(undefined as never);
    vi.mocked(transacaoService.registrar).mockResolvedValue({ transacao: { id: 'x' } } as never);
    const montado = montar();
    await act(() => Promise.resolve(montado.result.current.modal.onSubmit(payload)));
    montado.unmount();

    await act(async () => aviso()?.desfazer?.());
    expect(transacaoService.excluir).toHaveBeenCalledWith('x', 'fam-1');
  });

  it('editar mostra "Alterações salvas", sem "Desfazer"', async () => {
    vi.mocked(transacaoService.editar).mockResolvedValue({ transacao: { id: 't' } } as never);
    const { result } = montar();
    await act(() => Promise.resolve(result.current.modal.onUpdate?.('t', edicao)));
    expect(aviso()?.mensagem).toBe('Alterações salvas');
    expect(aviso()?.desfazer).toBeUndefined();
  });

  it('excluir mostra "Lançamento excluído", sem "Desfazer"', async () => {
    vi.mocked(transacaoService.excluir).mockResolvedValue(undefined as never);
    const { result } = montar();
    await act(() => Promise.resolve(result.current.modal.onDelete?.('t')));
    expect(aviso()?.mensagem).toBe('Lançamento excluído');
    expect(aviso()?.desfazer).toBeUndefined();
  });

  it('falha ao gravar não mostra aviso', async () => {
    vi.mocked(transacaoService.registrar).mockRejectedValue(new Error('falhou'));
    const { result } = montar();
    await act(async () => {
      await result.current.modal.onSubmit(payload).catch(() => {});
    });
    expect(aviso()).toBeNull();
  });
});
