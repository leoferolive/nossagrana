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
  familiaId: string;
}

export const FamilySettingsPage = ({
  onBackToOnboarding,
  onGoToDashboard,
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
      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        <p className="font-semibold text-text">Membros</p>
        <ul className="space-y-2">
          {membros.map((membro) => (
            <li
              key={membro.usuarioId}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span>
                {membro.nome || membro.usuarioId.slice(-8)}{' '}
                <span className="text-xs uppercase text-text-dim">({membro.role})</span>
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

        <div className="space-y-2">
          <p className="font-semibold text-text">Solicitações pendentes</p>
          <ul className="space-y-2">
            {solicitacoesPendentes.map((solicitacao) => (
              <li
                key={solicitacao.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>{solicitacao.usuarioId}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRevisarSolicitacao(solicitacao.id, 'aprovar')}
                    className="text-xs font-semibold text-success transition hover:underline"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRevisarSolicitacao(solicitacao.id, 'rejeitar')}
                    className="text-xs font-semibold text-danger transition hover:underline"
                  >
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-text">Convites</p>
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
            <div className="space-y-2 rounded-md border border-border px-3 py-2">
              <p>Código: {inviteCode}</p>
              <button
                type="button"
                onClick={() => {
                  void copyInviteCode();
                }}
                className="text-xs font-semibold text-info transition hover:underline"
              >
                Copiar código
              </button>
              {isInviteCopied && <p className="text-xs text-success">Código copiado</p>}
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  );
};
