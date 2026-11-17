import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FamilySettingsPage } from './family-settings-page';
import { renderPagina } from '../test/render-pagina';

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
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

    renderPagina(<FamilySettingsPage familiaId="f1" />);

    await waitFor(() => {
      expect(mockListarMembros).toHaveBeenCalledWith('f1');
      expect(mockListarSolicitacoes).toHaveBeenCalledWith('f1');
    });
  });

  it('exibe membros retornados pela API', async () => {
    mockListarMembros.mockResolvedValue({ membros: MEMBROS });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });

    renderPagina(<FamilySettingsPage familiaId="f1" />);

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

    renderPagina(<FamilySettingsPage familiaId="f1" />);

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

    renderPagina(<FamilySettingsPage familiaId="f1" />);

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

  it('exibe erro ao falhar carregamento de membros', async () => {
    mockListarMembros.mockRejectedValue(new Error('Falha'));
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });

    renderPagina(<FamilySettingsPage familiaId="f1" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao carregar membros/i);
    });
  });

  it('exibe erro ao falhar remocao de membro', async () => {
    mockListarMembros.mockResolvedValue({ membros: MEMBROS });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });
    mockRemoverMembro.mockRejectedValue(new Error('Falha'));

    renderPagina(<FamilySettingsPage familiaId="f1" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remover u2/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /remover u2/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao remover membro/i);
    });
  });

  it('exibe erro ao falhar geracao de convite', async () => {
    mockListarMembros.mockResolvedValue({ membros: [] });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });
    mockGerarConvite.mockRejectedValue(new Error('Falha'));

    renderPagina(<FamilySettingsPage familiaId="f1" />);

    fireEvent.click(screen.getByRole('button', { name: /gerar c.digo de convite/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao gerar convite/i);
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

    renderPagina(<FamilySettingsPage familiaId="f1" />);

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
  describe('revisar solicitação atualiza a tela sem recarregar', () => {
    const NOVO_MEMBRO = {
      usuarioId: 'u3',
      familiaId: 'f1',
      nome: 'Maria',
      role: 'membro' as const,
      dataEntrada: '2026-01-04',
    };

    it('depois de aprovar, o novo membro aparece na lista e a solicitação some', async () => {
      mockListarMembros
        .mockResolvedValueOnce({ membros: MEMBROS })
        .mockResolvedValueOnce({ membros: [...MEMBROS, NOVO_MEMBRO] });
      mockListarSolicitacoes.mockResolvedValue({ solicitacoes: SOLICITACOES });
      mockRevisarSolicitacao.mockResolvedValue({});

      renderPagina(<FamilySettingsPage familiaId="f1" />);
      fireEvent.click(await screen.findByRole('button', { name: /^aprovar$/i }));

      expect(await screen.findByText('Maria')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^aprovar$/i })).not.toBeInTheDocument();
      expect(mockListarMembros).toHaveBeenCalledTimes(2);
      expect(mockListarMembros).toHaveBeenLastCalledWith('f1');
    });

    it('depois de rejeitar, a solicitação some e a lista de membros não muda', async () => {
      mockListarMembros.mockResolvedValue({ membros: MEMBROS });
      mockListarSolicitacoes.mockResolvedValue({ solicitacoes: SOLICITACOES });
      mockRevisarSolicitacao.mockResolvedValue({});

      renderPagina(<FamilySettingsPage familiaId="f1" />);
      fireEvent.click(await screen.findByRole('button', { name: /^rejeitar$/i }));

      await waitFor(() => {
        expect(mockRevisarSolicitacao).toHaveBeenCalledWith('s1', 'rejeitar', 'f1');
        expect(screen.queryByRole('button', { name: /^rejeitar$/i })).not.toBeInTheDocument();
      });
      expect(mockListarMembros).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Maria')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remover u2/i })).toBeInTheDocument();
    });

    it('se a recarga dos membros falhar, mostra o erro e mantém a lista anterior', async () => {
      mockListarMembros
        .mockResolvedValueOnce({ membros: MEMBROS })
        .mockRejectedValueOnce(new Error('Falha'));
      mockListarSolicitacoes.mockResolvedValue({ solicitacoes: SOLICITACOES });
      mockRevisarSolicitacao.mockResolvedValue({});

      renderPagina(<FamilySettingsPage familiaId="f1" />);
      fireEvent.click(await screen.findByRole('button', { name: /^aprovar$/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/erro ao carregar membros/i);
      expect(screen.getByRole('button', { name: /remover u2/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^aprovar$/i })).not.toBeInTheDocument();
    });
  });

  it('mostra o título como heading de nível 1 e o Voltar leva a Mais (link direto)', async () => {
    mockListarMembros.mockResolvedValue({ membros: MEMBROS });
    mockListarSolicitacoes.mockResolvedValue({ solicitacoes: [] });
    renderPagina(<FamilySettingsPage familiaId="f1" />, '/mais/familia');
    expect(screen.getByRole('heading', { level: 1, name: 'Família' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/mais$/);
    await waitFor(() => expect(mockListarMembros).toHaveBeenCalled());
  });
});
