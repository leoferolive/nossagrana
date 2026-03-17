import { useEffect, useState } from 'react';

import { AuthShell } from '@/components/ui/auth-shell';
import { familiaService } from '@/services/auth.service';
import type {
  FamiliaListJoinRequestsResponse,
  FamiliaListMembersResponse,
} from '@nossagrana/types';

interface FamilySettingsPageProps {
  onBackToOnboarding: () => void;
  onGoToDashboard?: () => void;
  onBack?: () => void;
  familiaId: string;
}

export const FamilySettingsPage = ({
  onBackToOnboarding,
  onGoToDashboard,
  onBack,
  familiaId,
}: FamilySettingsPageProps) => {
  const [membros, setMembros] = useState<FamiliaListMembersResponse['membros']>([]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<
    FamiliaListJoinRequestsResponse['solicitacoes']
  >([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviteCopied, setIsInviteCopied] = useState(false);

  useEffect(() => {
    if (!familiaId) return;
    familiaService
      .listarMembros(familiaId)
      .then((res) => setMembros(res.membros))
      .catch(() => {});
    familiaService
      .listarSolicitacoes(familiaId)
      .then((res) => setSolicitacoesPendentes(res.solicitacoes))
      .catch(() => {});
  }, [familiaId]);

  const removeMember = async (usuarioId: string) => {
    if (!familiaId) return;
    try {
      await familiaService.removerMembro(familiaId, usuarioId);
      setMembros((current) => current.filter((m) => m.usuarioId !== usuarioId));
    } catch {
      // silently ignore removal errors
    }
  };

  const handleRevisarSolicitacao = async (id: string, acao: 'aprovar' | 'rejeitar') => {
    if (!familiaId) return;
    try {
      await familiaService.revisarSolicitacao(id, acao, familiaId);
      setSolicitacoesPendentes((current) => current.filter((s) => s.id !== id));
    } catch {
      // silently ignore review errors
    }
  };

  const generateInviteCode = async () => {
    if (!familiaId) return;
    try {
      const res = await familiaService.gerarConvite(familiaId);
      setInviteCode(res.convite.codigo);
      setIsInviteCopied(false);
    } catch {
      // silently ignore invite errors
    }
  };

  const copyInviteCode = async () => {
    if (!inviteCode || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(inviteCode);
    setIsInviteCopied(true);
  };

  const isInApp = !!onBack;

  const content = (
    <>
      {/* Membros */}
      <section className="rounded-xl border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Membros</h2>
        <ul className="space-y-0">
          {membros.map((membro, i) => (
            <li
              key={membro.usuarioId}
              className={`flex items-center gap-3 py-3 ${i < membros.length - 1 ? 'border-b border-border' : ''}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-sm font-bold text-success">
                {(membro.nome || membro.usuarioId)[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-text">
                  {membro.nome || membro.usuarioId.slice(-8)}
                </div>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${membro.role === 'admin' ? 'bg-success/15 text-success' : 'bg-surface text-text-muted'}`}
              >
                {membro.role === 'admin' ? 'Admin' : 'Membro'}
              </span>
              {membro.role !== 'admin' && (
                <button
                  type="button"
                  aria-label={`Remover ${membro.nome || membro.usuarioId}`}
                  onClick={() => {
                    void removeMember(membro.usuarioId);
                  }}
                  className="text-xs font-semibold text-danger transition hover:underline"
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Convite */}
      <section className="rounded-xl border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Convite</h2>
        <button
          type="button"
          onClick={() => {
            void generateInviteCode();
          }}
          className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-info transition hover:border-info"
        >
          Gerar código de convite
        </button>

        {inviteCode && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-bg px-4 py-3">
            <code className="text-sm font-semibold tracking-wider text-info">{inviteCode}</code>
            <button
              type="button"
              onClick={() => {
                void copyInviteCode();
              }}
              className="text-xs font-semibold text-success transition hover:underline"
            >
              Copiar
            </button>
          </div>
        )}
        {isInviteCopied && <p className="mt-1 text-xs text-success">Código copiado</p>}
      </section>

      {/* Solicitações Pendentes */}
      <section className="rounded-xl border border-border bg-panel p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
          Solicitações Pendentes
        </h2>
        {solicitacoesPendentes.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma solicitação pendente.</p>
        ) : (
          <ul className="space-y-3">
            {solicitacoesPendentes.map((solicitacao) => (
              <li
                key={solicitacao.id}
                className="flex items-center justify-between rounded-lg border border-border bg-bg px-4 py-3"
              >
                <span className="text-sm font-semibold text-text">{solicitacao.usuarioId}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRevisarSolicitacao(solicitacao.id, 'aprovar')}
                    className="rounded-md bg-success px-3 py-1 text-xs font-bold text-white transition hover:bg-success-strong"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRevisarSolicitacao(solicitacao.id, 'rejeitar')}
                    className="rounded-md border border-border px-3 py-1 text-xs font-bold text-text-muted transition hover:text-text"
                  >
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );

  if (isInApp) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="flex items-center gap-3 border-b border-border px-4 py-4">
          <button
            type="button"
            aria-label="Voltar"
            onClick={onBack}
            className="text-text-muted transition hover:text-text"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-text">Família</h1>
        </header>

        <div className="flex-1 space-y-4 p-4">{content}</div>
      </div>
    );
  }

  return (
    <AuthShell
      title="Configurações da família"
      subtitle="Gestão de membros, convites e solicitações."
      footer={
        <div className="flex flex-col items-center gap-2">
          {onGoToDashboard && (
            <button
              type="button"
              onClick={onGoToDashboard}
              className="font-semibold text-success transition hover:underline"
            >
              Ir para o Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={onBackToOnboarding}
            className="font-semibold text-info transition hover:underline"
          >
            Voltar ao onboarding
          </button>
        </div>
      }
    >
      <div className="space-y-4">{content}</div>
    </AuthShell>
  );
};
