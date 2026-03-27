import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { AppShell } from './app-shell';

function getFab(label: string): HTMLElement {
  const buttons = screen.getAllByLabelText(label);
  const fab = buttons.find((btn) => btn.classList.contains('fixed'));
  if (!fab) throw new Error(`FAB with label "${label}" not found`);
  return fab;
}

describe('AppShell', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanup();
  });

  describe('FAB long press', () => {
    it('calls onNovaTransacao on short click', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const onNovaTransacao = vi.fn();

      render(
        <AppShell
          currentScreen="dashboard"
          onNavigate={vi.fn()}
          onNovaTransacao={onNovaTransacao}
          onVoiceActivate={vi.fn()}
          onLogout={vi.fn()}
        >
          <div>content</div>
        </AppShell>,
      );

      const fab = getFab('Nova transação. Segure para usar voz');
      fireEvent.click(fab);
      expect(onNovaTransacao).toHaveBeenCalledOnce();
    });

    it('calls onVoiceActivate on long press (500ms)', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const onVoiceActivate = vi.fn();

      render(
        <AppShell
          currentScreen="dashboard"
          onNavigate={vi.fn()}
          onNovaTransacao={vi.fn()}
          onVoiceActivate={onVoiceActivate}
          onLogout={vi.fn()}
        >
          <div>content</div>
        </AppShell>,
      );

      const fab = getFab('Nova transação. Segure para usar voz');
      fireEvent.mouseDown(fab, { clientX: 100, clientY: 100 });
      vi.advanceTimersByTime(500);

      expect(onVoiceActivate).toHaveBeenCalledOnce();
    });

    it('does not call onVoiceActivate when pointer moves > 10px', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const onVoiceActivate = vi.fn();

      render(
        <AppShell
          currentScreen="dashboard"
          onNavigate={vi.fn()}
          onNovaTransacao={vi.fn()}
          onVoiceActivate={onVoiceActivate}
          onLogout={vi.fn()}
        >
          <div>content</div>
        </AppShell>,
      );

      const fab = getFab('Nova transação. Segure para usar voz');
      fireEvent.mouseDown(fab, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(fab, { clientX: 120, clientY: 100 });
      vi.advanceTimersByTime(500);

      expect(onVoiceActivate).not.toHaveBeenCalled();
    });

    it('uses simple aria-label when onVoiceActivate not provided', () => {
      render(
        <AppShell
          currentScreen="dashboard"
          onNavigate={vi.fn()}
          onNovaTransacao={vi.fn()}
          onLogout={vi.fn()}
        >
          <div>content</div>
        </AppShell>,
      );

      const fab = getFab('Nova transação');
      expect(fab).toBeInTheDocument();
    });
  });
});
