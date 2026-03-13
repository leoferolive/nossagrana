import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders setup confirmation text', () => {
    render(<App />);

    expect(screen.getByText('Setup inicial concluido')).toBeInTheDocument();
    expect(screen.getByText(/Ambiente pronto para fase 1/i)).toBeInTheDocument();
  });
});
