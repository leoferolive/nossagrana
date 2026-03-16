import { type FormEvent, useState } from 'react';

import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';
import { useAuth } from '@/contexts/use-auth';
import { authService, familiaService } from '@/services/auth.service';

interface LoginPageProps {
  onOpenSignUp: () => void;
  onLoginSuccess?: () => void;
}

export const LoginPage = ({ onOpenSignUp, onLoginSuccess }: LoginPageProps) => {
  const { login, updateFamiliaIdAtiva } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const response = await authService.login({ email, senha });
      login({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        familiaIdAtiva: '',
      });
      const minhas = await familiaService.listarMinhas();
      if (minhas.familias.length > 0) {
        const resultado = await familiaService.alternar(minhas.familias[0].id);
        updateFamiliaIdAtiva(resultado.familiaIdAtiva);
      }
      onLoginSuccess?.();
    } catch {
      setErro('E-mail ou senha incorretos. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AuthShell
      title="Entrar no NossaGrana"
      subtitle="Acesse sua conta para continuar."
      footer={
        <>
          Não tem conta?{' '}
          <button
            type="button"
            onClick={onOpenSignUp}
            className="font-semibold text-info transition hover:underline"
          >
            Cadastre-se
          </button>
        </>
      }
    >
      <form
        aria-label="login"
        className="space-y-4"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <FormField
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          id="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        {erro !== null && (
          <p role="alert" className="text-sm text-error">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded-lg bg-success px-4 py-2.5 font-semibold text-white transition hover:bg-success-strong focus:outline-none focus:ring-2 focus:ring-success/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthShell>
  );
};
