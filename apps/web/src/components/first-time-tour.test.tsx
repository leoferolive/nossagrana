import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { FirstTimeTour } from './first-time-tour';

const steps = [
  { icon: '👋', title: 'Bem-vindo!', description: 'Esta é a tela principal.' },
  { icon: '💰', title: 'Transações', description: 'Clique em + para adicionar uma transação.' },
  { title: 'Fim', description: 'Pronto para usar!' },
];

afterEach(() => {
  cleanup();
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('FirstTimeTour', () => {
  it('exibe o tour quando não foi visto antes', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    expect(screen.getByText('Bem-vindo!')).toBeInTheDocument();
    expect(screen.getByText('Esta é a tela principal.')).toBeInTheDocument();
  });

  it('não exibe o tour quando já foi visto', () => {
    localStorageMock.getItem.mockReturnValue('true');
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    expect(screen.queryByText('Bem-vindo!')).not.toBeInTheDocument();
  });

  it('exibe ícone do step quando fornecido', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    expect(screen.getByText('👋')).toBeInTheDocument();
  });

  it('avança para o próximo passo', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    expect(screen.getByText('Transações')).toBeInTheDocument();
  });

  it('volta para o passo anterior', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    expect(screen.getByText('Transações')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(screen.getByText('Bem-vindo!')).toBeInTheDocument();
  });

  it('não exibe botão voltar no primeiro passo', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    expect(screen.queryByRole('button', { name: /voltar/i })).not.toBeInTheDocument();
  });

  it('fecha o tour no último passo e salva no localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }));
    expect(screen.queryByText('Fim')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tour-dashboard', 'true');
  });

  it('fecha o tour ao clicar em pular', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /pular/i }));
    expect(screen.queryByText('Bem-vindo!')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tour-dashboard', 'true');
  });

  it('exibe progress dots', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    const { container } = render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(steps.length);
  });
});
