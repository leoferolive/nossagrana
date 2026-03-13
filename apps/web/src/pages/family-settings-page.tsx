import { AuthShell } from '@/components/ui/auth-shell';

interface FamilySettingsPageProps {
  onBackToOnboarding: () => void;
}

export const FamilySettingsPage = ({ onBackToOnboarding }: FamilySettingsPageProps) => {
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
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
        <p>Membros</p>
        <p>Solicitacoes pendentes</p>
        <p>Convites</p>
      </div>
    </AuthShell>
  );
};
