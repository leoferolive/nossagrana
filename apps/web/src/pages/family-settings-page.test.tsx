import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FamilySettingsPage } from './family-settings-page';

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

const mockListarMembros = vi.fn();
const mockListarSolicitacoes = vi.fn();
const mockGerarConvite = vi.fn();
const mockRemoverMembro = vi.fn();
const mockRevisarSolicitacao = vi.fn();

vi.mock('@/services/auth.service', () => ({
  familiaService: {
    listarMembros: (...args: unknown[]) => mockListarMembros(...args),
    listarSolicitacoes: (...args: unknown[]) => mockListarSolicitacoes(...args),
    gerarConvite: (...args: unknown[]) => mockGerarConvite(...args),
    removerMembro: (...args: unknown[]) => mockRemoverMembro(...args),
    revisarSolicitacao: (...args: unknown[]) => mockRevisarSolicitacao(...args),
  },
}));

const MEMBROS = [
  {
    usuarioId: 'u1',
    familiaId: 'f1',
    nome: 'u1',
    role: 'admin' as const,
    dataEntrada: '2026-01-01',
  },
  {
    usuarioId: 'u2',
    familiaId: 'f1',
    nome: 'u2',
    role: 'membro' as const,
    dataEntrada: '2026-01-02',
  },
];

const SOLICITACOES = [
  {
    id: 's1',
    familiaId: 'f1',
    usuarioId: 'u3',
    status: 'pendente' as const,
    solicitadoEm: '2026-01-03',
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FamilySettingsPage', () => {
  it('chama listarMembros e listarSolicitacoes ao montar com familiaId', async () => {
    mockListarMembros.mockResolvedValue({ membros: MEMBROS });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: SOLICITACOES });

    render(<FamilySettingsPage onBackToOnboarding={vi.fn()} familiaId="f1" />);

    await waitFor(() => {
      expect(mockListarMembros).toHaveBeenCalledWith('f1');
      expect(mockListarSolicitacoes).toHaveBeenCalledWith('f1');
    });
  });

  it('exibe membros retornados pela API', async () => {
    mockListarMembros.mockResolvedValue({ membros: MEMBROS });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });

    render(<FamilySettingsPage onBackToOnboarding={vi.fn()} familiaId="f1" />);

    await waitFor(() => {
      expect(screen.getAllByText(/u1/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/u2/i).length).toBeGreaterThan(0);
    });
  });

  it('gerarConvite chama familiaService.gerarConvite e exibe o codigo', async () => {
    mockListarMembros.mockResolvedValue({ membros: [] });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });
    mockGerarConvite.mockResolvedValue({
      convite: {
        id: 'inv1',
        codigo: 'FAM-REAL-CODE',
        familiaId: 'f1',
        criadoPor: 'u1',
        expiraEm: '2026-02-01',
        dataCriacao: '2026-01-01',
      },
    });

    render(<FamilySettingsPage onBackToOnboarding={vi.fn()} familiaId="f1" />);

    fireEvent.click(screen.getByRole('button', { name: /gerar c.digo de convite/i }));

    await waitFor(() => {
      expect(mockGerarConvite).toHaveBeenCalledWith('f1');
    });

    await waitFor(() => {
      expect(screen.getByText(/FAM-REAL-CODE/i)).toBeInTheDocument();
    });
  });

  it('removerMembro chama familiaService.removerMembro e remove da lista', async () => {
    mockListarMembros.mockResolvedValue({ membros: MEMBROS });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });
    mockRemoverMembro.mockResolvedValue(undefined);

    render(<FamilySettingsPage onBackToOnboarding={vi.fn()} familiaId="f1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remover u2/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /remover u2/i }));

    await waitFor(() => {
      expect(mockRemoverMembro).toHaveBeenCalledWith('f1', 'u2');
    });

    await waitFor(() => {
      expect(screen.queryByText(/remover u2/i)).not.toBeInTheDocument();
    });
  });

  it('aprovar chama revisarSolicitacao com "aprovar" e remove da lista', async () => {
    mockListarMembros.mockResolvedValue({ membros: [] });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: SOLICITACOES });
    mockRevisarSolicitacao.mockResolvedValue({
      solicitacao: {
        id: 's1',
        familiaId: 'f1',
        usuarioId: 'u3',
        status: 'aprovada',
        solicitadoEm: '2026-01-03',
        respondidoEm: '2026-01-04',
        respondidoPor: 'u1',
      },
    });

    render(<FamilySettingsPage onBackToOnboarding={vi.fn()} familiaId="f1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aprovar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^aprovar$/i }));

    await waitFor(() => {
      expect(mockRevisarSolicitacao).toHaveBeenCalledWith('s1', 'aprovar', 'f1');
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^aprovar$/i })).not.toBeInTheDocument();
    });
  });
});
