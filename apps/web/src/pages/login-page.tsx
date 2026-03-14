import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';

interface LoginPageProps {
  onOpenSignUp: () => void;
  onLoginSuccess?: () => void;
}

export const LoginPage = ({ onOpenSignUp, onLoginSuccess }: LoginPageProps) => {
  return (
    <AuthShell
      title="Entrar no NossaGrana"
      subtitle="Acesse sua conta para continuar."
      footer={
        <>
          Nao tem conta?{' '}
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
          e.preventDefault();
          onLoginSuccess?.();
        }}
      >
        <FormField id="email" label="E-mail" type="email" autoComplete="email" />
        <FormField id="password" label="Senha" type="password" autoComplete="current-password" />
        <PrimaryButton type="submit">Entrar</PrimaryButton>
      </form>
    </AuthShell>
  );
};
