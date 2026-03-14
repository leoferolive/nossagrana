import { useState } from 'react';

import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';

type OnboardingMode = 'create' | 'invite' | 'request';

interface FamilyOption {
  id: string;
  nome: string;
}

interface OnboardingPageProps {
  onOpenLogin: () => void;
  onOpenFamilySettings: () => void;
}

export const OnboardingPage = ({ onOpenLogin, onOpenFamilySettings }: OnboardingPageProps) => {
  const [mode, setMode] = useState<OnboardingMode>('create');
  const familyOptions: FamilyOption[] = [
    { id: 'familia-oliveira', nome: 'Familia Oliveira' },
    { id: 'familia-souza', nome: 'Familia Souza' },
  ];
  const [selectedFamilyId, setSelectedFamilyId] = useState(familyOptions[0].id);
  const [activeFamilyName, setActiveFamilyName] = useState(familyOptions[0].nome);

  const handleSwitchFamily = () => {
    const selectedFamily = familyOptions.find((family) => family.id === selectedFamilyId);
    if (!selectedFamily) {
      return;
    }

    setActiveFamilyName(selectedFamily.nome);
  };

  return (
    <AuthShell
      title="Como deseja entrar na sua familia?"
      subtitle="Escolha uma opcao para concluir seu onboarding."
      footer={
        <>
          Ja tem familia ativa?{' '}
          <button
            type="button"
            onClick={onOpenLogin}
            className="font-semibold text-info transition hover:underline"
          >
            Ir para login
          </button>
        </>
      }
    >
      <div className="mb-4 space-y-2 rounded-lg border border-border bg-surface p-3 text-sm text-text-muted">
        <p className="font-semibold text-text">Familia ativa: {activeFamilyName}</p>
        <label htmlFor="activeFamily" className="block text-xs font-medium uppercase tracking-wide">
          Selecionar familia ativa
        </label>
        <div className="flex items-center gap-2">
          <select
            id="activeFamily"
            value={selectedFamilyId}
            onChange={(event) => setSelectedFamilyId(event.target.value)}
            className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text outline-none transition focus:border-info focus:ring-2 focus:ring-info/30"
          >
            {familyOptions.map((family) => (
              <option key={family.id} value={family.id}>
                {family.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSwitchFamily}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-info transition hover:border-info"
          >
            Alternar familia
          </button>
        </div>
      </div>

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

      <button
        type="button"
        onClick={onOpenFamilySettings}
        className="mb-4 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
      >
        Configuracoes da familia
      </button>

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
