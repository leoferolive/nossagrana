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

  const removeMember = (memberId: string) => {
    setMembros((currentMembers) => currentMembers.filter((member) => member.id !== memberId));
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
            <li key={membro.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span>
                {membro.nome} <span className="text-xs uppercase text-text-dim">({membro.role})</span>
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

        <p>Solicitacoes pendentes</p>
        <p>Convites</p>
      </div>
    </AuthShell>
  );
};
