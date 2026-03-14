import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { MetodosPagamentoPage } from './metodos-pagamento-page';

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
});

const METODOS = [
  { id: 'm1', nome: 'Nubank', tipo: 'credito' as const, dataFechamento: 15, dataVencimento: 22, usuarioDonoId: 'u1', ativo: true, familiaId: 'f1', criadoEm: '2026-01-01' },
  { id: 'm2', nome: 'Pix pessoal', tipo: 'pix' as const, dataFechamento: null, dataVencimento: null, usuarioDonoId: 'u1', ativo: true, familiaId: 'f1', criadoEm: '2026-01-01' },
];

describe('MetodosPagamentoPage', () => {
  beforeEach(() => {
    useMetodoPagamentoStore.setState({ metodos: METODOS, carregando: false, erro: null });
  });

  it('exibe lista de métodos', () => {
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('Pix pessoal')).toBeInTheDocument();
  });

  it('exibe badge do tipo', () => {
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText('credito')).toBeInTheDocument();
    expect(screen.getByText('pix')).toBeInTheDocument();
  });

  it('exibe datas de fechamento/vencimento para crédito', () => {
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText(/fecha dia 15/i)).toBeInTheDocument();
  });

  it('abre formulário ao clicar em novo método', () => {
    render(<MetodosPagamentoPage familiaId="f1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /novo método/i }));
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
  });

  it('chama onBack ao clicar em voltar', () => {
    const onBack = vi.fn();
    render(<MetodosPagamentoPage familiaId="f1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
