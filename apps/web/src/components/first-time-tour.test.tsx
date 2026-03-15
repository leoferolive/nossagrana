import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  { title: 'Bem-vindo!', description: 'Esta é a tela principal.' },
  { title: 'Transações', description: 'Clique em + para adicionar uma transação.' },
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

  it('avança para o próximo passo', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    expect(screen.getByText('Transações')).toBeInTheDocument();
  });

  it('fecha o tour no último passo e salva no localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }));
    expect(screen.queryByText('Transações')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tour-dashboard', 'true');
  });

  it('fecha o tour ao clicar em pular', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    fireEvent.click(screen.getByRole('button', { name: /pular/i }));
    expect(screen.queryByText('Bem-vindo!')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenCalledWith('tour-dashboard', 'true');
  });

  it('mostra indicador de progresso (passo N de M)', () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    render(<FirstTimeTour tourKey="dashboard" steps={steps} />);
    expect(screen.getByText(/1.*2/)).toBeInTheDocument();
  });
});
