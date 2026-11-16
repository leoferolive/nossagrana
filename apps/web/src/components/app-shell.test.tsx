import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './app-shell';

const renderShell = (
  props: { caminho?: string; onNovaTransacao?: () => void; onVoiceActivate?: () => void } = {},
) =>
  render(
    <MemoryRouter initialEntries={[props.caminho ?? '/']}>
      <AppShell
        onNovaTransacao={props.onNovaTransacao ?? vi.fn()}
        onVoiceActivate={props.onVoiceActivate}
        onLogout={vi.fn()}
      >
        <div>content</div>
      </AppShell>
    </MemoryRouter>,
  );

describe('AppShell', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('não renderiza mais o botão flutuante: o único "Lançar" mora na barra', () => {
    renderShell({ onVoiceActivate: vi.fn() });
    const botoes = screen.getAllByRole('button', { name: /lançar|nova transação/i });
    const flutuantes = botoes.filter((b) => b.classList.contains('fixed'));
    expect(flutuantes).toHaveLength(0);
    const barra = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(barra).getByRole('button', { name: 'Lançar' })).toBeInTheDocument();
  });

  it('marca a aba pelo endereço, inclusive em tela de segundo nível', () => {
    renderShell({ caminho: '/mais/categorias' });
    const barra = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(barra).getByRole('link', { name: 'Mais' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('toque curto no "+" chama onNovaTransacao', () => {
    const onNovaTransacao = vi.fn();
    renderShell({ onNovaTransacao });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(onNovaTransacao).toHaveBeenCalledOnce();
  });

  it('toque longo no "+" chama onVoiceActivate', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onVoiceActivate = vi.fn();
    renderShell({ onVoiceActivate });
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Lançar' }), {
      clientX: 100,
      clientY: 100,
    });
    vi.advanceTimersByTime(500);
    expect(onVoiceActivate).toHaveBeenCalledOnce();
  });
});
