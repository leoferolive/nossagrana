import { type FormEvent, useState } from 'react';

import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';
import { useAuth } from '@/contexts/use-auth';
import { authService } from '@/services/auth.service';
import { ApiError } from '@/services/api-client';

interface SignUpPageProps {
  onOpenLogin: () => void;
  onCompleteSignUp: () => void;
}

export const SignUpPage = ({ onOpenLogin, onCompleteSignUp }: SignUpPageProps) => {
  const { login } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (senha !== confirmSenha) {
      setErro('As senhas não coincidem');
      return;
    }

    setCarregando(true);

    try {
      await authService.register({ nome, email, senha });
      const loginResponse = await authService.login({ email, senha });
      login({
        accessToken: loginResponse.accessToken,
        refreshToken: loginResponse.refreshToken,
        familiaIdAtiva: '',
      });
      onCompleteSignUp();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setErro('Este e-mail já está cadastrado');
      } else {
        setErro('Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <AuthShell
      title="Criar conta no NossaGrana"
      subtitle="Junte sua família e organize tudo em um lugar."
      footer={
        <>
          Já tem conta?{' '}
          <button
            type="button"
            onClick={onOpenLogin}
            className="font-semibold text-info transition hover:underline"
          >
            Entrar
          </button>
        </>
      }
    >
      <form
        aria-label="cadastro"
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <FormField
          id="fullName"
          label="Nome completo"
          type="text"
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
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
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <FormField
          id="confirmPassword"
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          value={confirmSenha}
          onChange={(e) => setConfirmSenha(e.target.value)}
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
          {carregando ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>
    </AuthShell>
  );
};
