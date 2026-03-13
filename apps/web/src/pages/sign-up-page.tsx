import { AuthShell } from '@/components/ui/auth-shell';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';

interface SignUpPageProps {
  onOpenLogin: () => void;
}

export const SignUpPage = ({ onOpenLogin }: SignUpPageProps) => {
  return (
    <AuthShell
      title="Criar conta no NossaGrana"
      subtitle="Junte sua familia e organize tudo em um lugar."
      footer={
        <>
          Ja tem conta?{' '}
          <button type="button" onClick={onOpenLogin} className="font-semibold text-info transition hover:underline">
            Entrar
          </button>
        </>
      }
    >
      <form className="space-y-4">
        <FormField id="fullName" label="Nome completo" type="text" autoComplete="name" />
        <FormField id="email" label="E-mail" type="email" autoComplete="email" />
        <FormField id="password" label="Senha" type="password" autoComplete="new-password" />
        <FormField id="confirmPassword" label="Confirmar senha" type="password" autoComplete="new-password" />
        <PrimaryButton type="submit">Criar conta</PrimaryButton>
      </form>
    </AuthShell>
  );
};
