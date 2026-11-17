import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transacaoService } from '@/services/core-financeiro.service';
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
