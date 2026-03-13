import { useState } from 'react';

import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';

type OnboardingMode = 'create' | 'invite' | 'request';

interface OnboardingPageProps {
  onOpenLogin: () => void;
}

export const OnboardingPage = ({ onOpenLogin }: OnboardingPageProps) => {
  const [mode, setMode] = useState<OnboardingMode>('create');

  return (
    <AuthShell
      title="Como deseja entrar na sua familia?"
      subtitle="Escolha uma opcao para concluir seu onboarding."
      footer={
        <>
          Ja tem familia ativa?{' '}
          <button type="button" onClick={onOpenLogin} className="font-semibold text-info transition hover:underline">
            Ir para login
          </button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setMode('create')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
        >
          Criar familia
        </button>
        <button
          type="button"
          onClick={() => setMode('invite')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
        >
          Entrar com convite
        </button>
        <button
          type="button"
          onClick={() => setMode('request')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
        >
          Buscar e solicitar
        </button>
      </div>

      {mode === 'create' && (
        <form className="space-y-4">
          <FormField id="familyName" label="Nome da familia" type="text" autoComplete="off" />
          <PrimaryButton type="submit">Criar familia</PrimaryButton>
        </form>
      )}

      {mode === 'invite' && (
        <form className="space-y-4">
          <FormField id="inviteCode" label="Codigo de convite" type="text" autoComplete="off" />
          <PrimaryButton type="submit">Entrar com convite</PrimaryButton>
        </form>
      )}

      {mode === 'request' && (
        <form className="space-y-4">
          <FormField id="searchFamily" label="Nome da familia" type="text" autoComplete="off" />
          <PrimaryButton type="submit">Solicitar entrada</PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
};
