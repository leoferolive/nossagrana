import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAvisoStore } from '@/stores/aviso.store';

import { AvisoLancado } from './aviso-lancado';

afterEach(() => {
  cleanup();
  act(() => useAvisoStore.getState().fechar());
});

const mostrar = (aviso: Parameters<ReturnType<typeof useAvisoStore.getState>['mostrar']>[0]) =>
  act(() => useAvisoStore.getState().mostrar(aviso));

describe('AvisoLancado', () => {
  it('sem aviso não mostra nada', () => {
    render(<AvisoLancado />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra a mensagem como status, sem "Desfazer" quando não há como desfazer', () => {
    render(<AvisoLancado />);
    mostrar({ mensagem: 'Alterações salvas' });

    expect(screen.getByRole('status')).toHaveTextContent('Alterações salvas');
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
  });

  it('com desfazer mostra o botão e chama uma vez, mesmo tocado duas vezes', () => {
    const desfazer = vi.fn().mockResolvedValue(undefined);
    render(<AvisoLancado />);
    mostrar({ mensagem: 'Despesa lançada', desfazer });

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(desfazer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeDisabled();
  });

  it('um aviso novo chega com o botão habilitado de novo', () => {
    render(<AvisoLancado />);
    mostrar({ mensagem: 'A', desfazer: vi.fn().mockResolvedValue(undefined) });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    mostrar({ mensagem: 'B', desfazer: vi.fn().mockResolvedValue(undefined) });
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeEnabled();
  });

  it('aviso de erro usa o tom de alerta', () => {
    render(<AvisoLancado />);
    mostrar({ mensagem: 'Não foi possível desfazer', tom: 'erro' });
    expect(screen.getByRole('status').className).toContain('bg-danger-soft');
  });

  it('fica acima da barra (z-aviso) e tem 48px de altura', () => {
    render(<AvisoLancado />);
    mostrar({ mensagem: 'Despesa lançada' });
    const classes = screen.getByRole('status').className;
    expect(classes).toContain('z-aviso');
    expect(classes).toContain('min-h-12');
  });
});
