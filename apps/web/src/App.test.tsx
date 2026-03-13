import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('renders login screen', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /entrar no nossagrana/i })).toBeInTheDocument();
    expect(screen.getByText(/financas familiares em tempo real/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/nao tem conta\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastre-se/i })).toBeInTheDocument();
  });

  it('navigates to sign up screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));

    expect(screen.getByRole('heading', { name: /criar conta no nossagrana/i })).toBeInTheDocument();
    expect(screen.getByText(/junte sua familia e organize tudo em um lugar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mail$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('opens onboarding flow after sign up submit', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByRole('heading', { name: /como deseja entrar na sua familia/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /criar familia/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /entrar com convite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar e solicitar/i })).toBeInTheDocument();
  });

  it('opens family settings screen from onboarding', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    expect(screen.getByRole('heading', { name: /configuracoes da familia/i })).toBeInTheDocument();
    expect(screen.getByText(/gestao de membros, convites e solicitacoes/i)).toBeInTheDocument();
  });

  it('lists members and allows removing a member in family settings', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    expect(screen.getByText(/leo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remover maria/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remover maria/i }));

    expect(screen.queryByRole('button', { name: /remover maria/i })).not.toBeInTheDocument();
  });

  it('manages pending requests in family settings', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    expect(screen.getByRole('button', { name: /aprovar joao/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejeitar joao/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /aprovar joao/i }));

    expect(screen.queryByRole('button', { name: /aprovar joao/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rejeitar joao/i })).not.toBeInTheDocument();
  });

  it('generates and copies invite code in family settings', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.click(screen.getByRole('button', { name: /configuracoes da familia/i }));

    fireEvent.click(screen.getByRole('button', { name: /gerar codigo de convite/i }));

    expect(screen.getByText(/codigo: FAM-LEO-2026/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar codigo/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copiar codigo/i }));

    expect(writeText).toHaveBeenCalledWith('FAM-LEO-2026');
    expect(await screen.findByText(/codigo copiado/i)).toBeInTheDocument();
  });
});
