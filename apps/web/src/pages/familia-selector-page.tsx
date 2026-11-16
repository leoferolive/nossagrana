import type { FamiliaMinhasItem } from '@nossagrana/types';

import { ErrorBanner } from '@/components/error-banner';
import { AuthShell } from '@/components/ui/auth-shell';

interface FamiliaSelectorPageProps {
  familias: FamiliaMinhasItem[];
  onSelect: (familiaId: string) => void;
  familiaIdAtiva?: string | null;
  erro?: string | null;
  onGoToOnboarding: () => void;
}

const roleBadge = (role: string) => {
  if (role === 'admin') {
    return (
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-success">
        Admin
      </span>
    );
  }
  return (
    <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs font-semibold text-info">
      Membro
    </span>
  );
};

export const FamiliaSelectorPage = ({
  familias,
  onSelect,
  familiaIdAtiva,
  erro,
  onGoToOnboarding,
}: FamiliaSelectorPageProps) => (
  <AuthShell
    title="Escolha uma Família"
    subtitle="Selecione a família que deseja acessar."
    showBrand={false}
    footer={
      <>
        Quer criar ou entrar em outra família?{' '}
        <button
          type="button"
          onClick={onGoToOnboarding}
          className="font-semibold text-success transition hover:underline"
        >
          Nova família
        </button>
      </>
    }
  >
    <ErrorBanner error={erro ?? null} />
    <div className="flex flex-col gap-3" role="group" aria-label="Selecionar família">
      {familias.map((familia) => (
        <button
          key={familia.id}
          type="button"
          onClick={() => onSelect(familia.id)}
          className="flex items-center justify-between rounded-xl border border-border bg-panel p-4 text-left transition hover:border-success/50"
        >
          <div>
            <div className="text-sm font-bold text-text">{familia.nome}</div>
          </div>
          <div className="flex items-center gap-2">
            {roleBadge(familia.role)}
            {familia.id === familiaIdAtiva && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-text-muted">
                Atual
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  </AuthShell>
);
