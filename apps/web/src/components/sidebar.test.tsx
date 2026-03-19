import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from './sidebar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  currentScreen: 'dashboard',
  onNavigate: vi.fn(),
  onLogout: vi.fn(),
};

describe('Sidebar', () => {
  it('renderiza o título NossaGrana', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('NossaGrana')).toBeInTheDocument();
  });

  it('renderiza botão "Sair"', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('chama onLogout ao clicar em "Sair"', () => {
    const onLogout = vi.fn();
    render(<Sidebar {...defaultProps} onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
