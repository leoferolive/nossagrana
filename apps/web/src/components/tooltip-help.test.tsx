import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipHelp } from './tooltip-help';

afterEach(() => cleanup());

describe('TooltipHelp', () => {
  it('renderiza botão de ajuda', () => {
    render(<TooltipHelp text="Explicação de ajuda" />);
    expect(screen.getByRole('button', { name: /ajuda/i })).toBeInTheDocument();
  });

  it('não mostra tooltip por padrão', () => {
    render(<TooltipHelp text="Explicação de ajuda" />);
    expect(screen.queryByText('Explicação de ajuda')).not.toBeInTheDocument();
  });

  it('mostra tooltip ao clicar no botão', () => {
    render(<TooltipHelp text="Explicação de ajuda" />);
    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));
    expect(screen.getByText('Explicação de ajuda')).toBeInTheDocument();
  });

  it('esconde tooltip ao clicar novamente', () => {
    render(<TooltipHelp text="Explicação de ajuda" />);
    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));
    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));
    expect(screen.queryByText('Explicação de ajuda')).not.toBeInTheDocument();
  });
});
