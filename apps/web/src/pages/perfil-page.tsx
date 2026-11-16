import { useEffect, useState } from 'react';

import { CabecalhoDetalhe } from '../components/cabecalho-detalhe';
import { FirstTimeTour } from '../components/first-time-tour';
import { IconPerfil } from '../components/icons';
import { useAuth } from '@/contexts/use-auth';

import { CAMINHOS } from '../routes/caminhos';
import { ApiError } from '../services/api-client';
import { coreFinanceiroService } from '../services/core-financeiro.service';
import { CAMPO_CLASSES } from '../components/ui/campo-classes';

// Tempo para o usuário ler o aviso antes do logout forçado.
const LOGOUT_APOS_TROCA_DE_SENHA_MS = 2500;

const mensagemErroTrocaDeSenha = (error: unknown): string =>
  error instanceof ApiError && error.status === 401
    ? 'Senha atual incorreta.'
    : 'Não foi possível alterar a senha. Tente novamente.';

export const PerfilPage = () => {
  const { logout } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [perfilSalvo, setPerfilSalvo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaSalva, setSenhaSalva] = useState(false);

  // A troca de senha revoga todas as sessões, inclusive esta (#119): o logout é explícito
  // para não depender de o WebSocket estar conectado (4005) nem de o refresh falhar depois.
  useEffect(() => {
    if (!senhaSalva) return;
    const timer = setTimeout(logout, LOGOUT_APOS_TROCA_DE_SENHA_MS);
    return () => clearTimeout(timer);
  }, [senhaSalva, logout]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await coreFinanceiroService.getPerfil();
        setNome(data.nome);
        setEmail(data.email);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleSalvarPerfil = async () => {
    await coreFinanceiroService.updatePerfil({ nome });
    setPerfilSalvo(true);
    setTimeout(() => setPerfilSalvo(false), 2500);
  };

  const handleAlterarSenha = async () => {
    setErroSenha(null);
    try {
      await coreFinanceiroService.updateSenha({ senhaAtual, novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setSenhaSalva(true);
    } catch (error) {
      setErroSenha(mensagemErroTrocaDeSenha(error));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <FirstTimeTour
        tourKey="perfil"
        steps={[
          {
            icon: IconPerfil,
            title: 'Seu perfil',
            description:
              'Atualize seu nome de exibição e altere sua senha. Seu e-mail é usado para login e não pode ser alterado.',
          },
        ]}
      />

      <CabecalhoDetalhe titulo="Perfil" origem={CAMINHOS.mais} />

      <div className="flex-1 space-y-6 p-4">
        {/* Dados pessoais */}
        <section className="rounded-xl border border-border bg-panel p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase text-text-muted">Dados pessoais</h2>

          <div className="mb-3">
            <label htmlFor="nome" className="mb-1 block text-sm font-medium text-text">
              Nome
            </label>
            <input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={CAMPO_CLASSES}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text">
              Email
            </label>
            <input id="email" type="email" value={email} disabled className={CAMPO_CLASSES} />
          </div>

          <button
            type="button"
            aria-label="Salvar perfil"
            onClick={() => void handleSalvarPerfil()}
            className="w-full rounded-lg bg-success py-2.5 text-sm font-semibold text-white transition hover:bg-success-strong"
          >
            Salvar perfil
          </button>

          {perfilSalvo && (
            <p className="mt-2 text-center text-xs text-success">Salvo com sucesso!</p>
          )}
        </section>

        {/* Troca de senha */}
        <section className="rounded-xl border border-border bg-panel p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase text-text-muted">Alterar senha</h2>

          <div className="mb-3">
            <label htmlFor="senha-atual" className="mb-1 block text-sm font-medium text-text">
              Senha atual
            </label>
            <input
              id="senha-atual"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className={CAMPO_CLASSES}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="nova-senha" className="mb-1 block text-sm font-medium text-text">
              Nova senha
            </label>
            <input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className={CAMPO_CLASSES}
            />
          </div>

          {erroSenha && <p className="mb-2 text-xs text-danger">{erroSenha}</p>}

          <button
            type="button"
            aria-label="Alterar senha"
            onClick={() => void handleAlterarSenha()}
            className="w-full rounded-lg bg-surface py-2.5 text-sm font-semibold text-text transition hover:bg-surface/80"
          >
            Alterar senha
          </button>

          {senhaSalva && (
            <p className="mt-2 text-center text-xs text-success">
              Senha alterada. Entre novamente.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
