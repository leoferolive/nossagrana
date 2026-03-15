import { useState } from 'react';

import { useAuth } from '@/contexts/use-auth';
import { familiaService } from '@/services/auth.service';
import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';

type OnboardingMode = 'create' | 'invite' | 'request';

interface FamiliaOption {
  id: string;
  nome: string;
}

interface OnboardingPageProps {
  onOpenLogin: () => void;
  onOpenFamilySettings: () => void;
}

const submitButtonClass =
  'w-full rounded-lg bg-success px-4 py-2.5 font-semibold text-white transition hover:bg-success-strong focus:outline-none focus:ring-2 focus:ring-success/40 disabled:cursor-not-allowed disabled:opacity-60';

export const OnboardingPage = ({ onOpenLogin, onOpenFamilySettings }: OnboardingPageProps) => {
  const { updateFamiliaIdAtiva } = useAuth();
  const [mode, setMode] = useState<OnboardingMode>('create');

  const [nome, setNome] = useState('');
  const [codigoConvite, setCodigoConvite] = useState('');
  const [nomeBusca, setNomeBusca] = useState('');
  const [familiasEncontradas, setFamiliasEncontradas] = useState<FamiliaOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const res = await familiaService.criar({ nome });
      await familiaService.alternar(res.familia.id);
      updateFamiliaIdAtiva(res.familia.id);
      onOpenFamilySettings();
    } catch {
      setErro('Erro ao criar família. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const res = await familiaService.entrarPorConvite(codigoConvite);
      await familiaService.alternar(res.familia.id);
      updateFamiliaIdAtiva(res.familia.id);
      onOpenFamilySettings();
    } catch {
      setErro('Código inválido ou expirado.');
    } finally {
      setCarregando(false);
    }
  };

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    setSolicitacaoEnviada(false);
    try {
      const res = await familiaService.buscar(nomeBusca);
      setFamiliasEncontradas(res.familias);
    } catch {
      setErro('Erro ao buscar famílias. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleSolicitarEntrada = async (familiaId: string) => {
    setCarregando(true);
    setErro(null);
    try {
      await familiaService.solicitarEntrada(familiaId);
      setSolicitacaoEnviada(true);
    } catch {
      setErro('Erro ao solicitar entrada. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleModeChange = (newMode: OnboardingMode) => {
    setMode(newMode);
    setErro(null);
    setSolicitacaoEnviada(false);
    setFamiliasEncontradas([]);
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
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => handleModeChange('create')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
        >
          Criar familia
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('invite')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
        >
          Entrar com convite
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('request')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-info hover:text-info"
        >
          Buscar e solicitar
        </button>
      </div>

      {erro && (
        <div role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {erro}
        </div>
      )}

      {solicitacaoEnviada && (
        <div role="alert" className="mb-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Solicitação enviada com sucesso! Aguarde aprovação do administrador.
        </div>
      )}

      {mode === 'create' && (
        <form
          aria-label="Criar familia"
          onSubmit={(e) => {
            void handleCreate(e);
          }}
          className="space-y-4"
        >
          <FormField
            id="familyName"
            label="Nome da familia"
            type="text"
            autoComplete="off"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <button type="submit" disabled={carregando} className={submitButtonClass}>
            {carregando ? 'Criando...' : 'Criar familia'}
          </button>
        </form>
      )}

      {mode === 'invite' && (
        <form
          aria-label="Entrar com convite"
          onSubmit={(e) => {
            void handleInvite(e);
          }}
          className="space-y-4"
        >
          <FormField
            id="inviteCode"
            label="Codigo de convite"
            type="text"
            autoComplete="off"
            value={codigoConvite}
            onChange={(e) => setCodigoConvite(e.target.value)}
          />
          <button type="submit" disabled={carregando} className={submitButtonClass}>
            {carregando ? 'Entrando...' : 'Entrar com convite'}
          </button>
        </form>
      )}

      {mode === 'request' && (
        <>
          <form
            aria-label="Buscar familia"
            onSubmit={(e) => {
              void handleBuscar(e);
            }}
            className="space-y-4"
          >
            <FormField
              id="searchFamily"
              label="Nome da familia"
              type="text"
              autoComplete="off"
              value={nomeBusca}
              onChange={(e) => setNomeBusca(e.target.value)}
            />
            <button type="submit" disabled={carregando} className={submitButtonClass}>
              {carregando ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {familiasEncontradas.length > 0 && (
            <ul className="mt-4 space-y-2">
              {familiasEncontradas.map((familia) => (
                <li
                  key={familia.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <span className="text-sm text-text">{familia.nome}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleSolicitarEntrada(familia.id);
                    }}
                    disabled={carregando}
                    className="rounded-lg border border-border bg-panel px-3 py-1 text-xs font-semibold text-info transition hover:border-info disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Solicitar entrada
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AuthShell>
  );
};
