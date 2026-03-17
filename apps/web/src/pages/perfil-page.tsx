import { useEffect, useState } from 'react';

import { FirstTimeTour } from '../components/first-time-tour';
import { IconVoltar } from '../components/icons';
import { coreFinanceiroService } from '../services/core-financeiro.service';

interface PerfilPageProps {
  onBack: () => void;
}

export const PerfilPage = ({ onBack }: PerfilPageProps) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [perfilSalvo, setPerfilSalvo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaSalva, setSenhaSalva] = useState(false);

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
      setTimeout(() => setSenhaSalva(false), 2500);
    } catch {
      setErroSenha('Senha atual incorreta.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <FirstTimeTour
        tourKey="perfil"
        steps={[{ title: 'Perfil', description: 'Atualize seu nome e gerencie sua senha aqui.' }]}
      />

      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="text-text-muted transition hover:text-text"
        >
          <IconVoltar size={20} />
        </button>
        <h1 className="text-lg font-bold text-text">Perfil</h1>
      </header>

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
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted"
            />
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
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
            <p className="mt-2 text-center text-xs text-success">Senha alterada com sucesso!</p>
          )}
        </section>
      </div>
    </div>
  );
};
