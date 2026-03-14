import { useState } from 'react';

import { AuthShell } from '@/components/ui/auth-shell';

interface FamilySettingsPageProps {
  onBackToOnboarding: () => void;
}

export const FamilySettingsPage = ({ onBackToOnboarding }: FamilySettingsPageProps) => {
  const [membros, setMembros] = useState([
    { id: '1', nome: 'Leo', role: 'admin' as const },
    { id: '2', nome: 'Maria', role: 'membro' as const },
  ]);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState([{ id: 'r1', nome: 'Joao' }]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isInviteCopied, setIsInviteCopied] = useState(false);

  const removeMember = (memberId: string) => {
    setMembros((currentMembers) => currentMembers.filter((member) => member.id !== memberId));
  };
  const handlePendingRequest = (requestId: string) => {
    setSolicitacoesPendentes((currentRequests) =>
      currentRequests.filter((request) => request.id !== requestId),
    );
  };
  const generateInviteCode = () => {
    setInviteCode('FAM-LEO-2026');
    setIsInviteCopied(false);
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
      title="Configuracoes da familia"
      subtitle="Gestao de membros, convites e solicitacoes."
      footer={
        <button
          type="button"
          onClick={onBackToOnboarding}
          className="font-semibold text-info transition hover:underline"
        >
          Voltar ao onboarding
        </button>
      }
    >
      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        <p className="font-semibold text-text">Membros</p>
        <ul className="space-y-2">
          {membros.map((membro) => (
            <li
              key={membro.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span>
                {membro.nome}{' '}
                <span className="text-xs uppercase text-text-dim">({membro.role})</span>
              </span>

              {membro.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => removeMember(membro.id)}
                  className="text-xs font-semibold text-danger transition hover:underline"
                >
                  Remover {membro.nome}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <p className="font-semibold text-text">Solicitacoes pendentes</p>
          <ul className="space-y-2">
            {solicitacoesPendentes.map((solicitacao) => (
              <li
                key={solicitacao.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span>{solicitacao.nome}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePendingRequest(solicitacao.id)}
                    className="text-xs font-semibold text-success transition hover:underline"
                  >
                    Aprovar {solicitacao.nome}
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePendingRequest(solicitacao.id)}
                    className="text-xs font-semibold text-danger transition hover:underline"
                  >
                    Rejeitar {solicitacao.nome}
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
            onClick={generateInviteCode}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-info transition hover:border-info"
          >
            Gerar codigo de convite
          </button>

          {inviteCode && (
            <div className="space-y-2 rounded-md border border-border px-3 py-2">
              <p>Codigo: {inviteCode}</p>
              <button
                type="button"
                onClick={() => {
                  void copyInviteCode();
                }}
                className="text-xs font-semibold text-info transition hover:underline"
              >
                Copiar codigo
              </button>
              {isInviteCopied && <p className="text-xs text-success">Codigo copiado</p>}
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  );
};
