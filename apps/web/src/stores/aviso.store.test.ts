import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAvisoStore } from './aviso.store';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  useAvisoStore.getState().fechar();
});

afterEach(() => {
  useAvisoStore.getState().fechar();
  vi.useRealTimers();
});

describe('useAvisoStore', () => {
  it('começa sem aviso', () => {
    expect(useAvisoStore.getState().aviso).toBeNull();
  });

  it('mostra o aviso e ele some sozinho em 6 segundos', () => {
    useAvisoStore.getState().mostrar({ mensagem: 'Despesa lançada' });
    expect(useAvisoStore.getState().aviso?.mensagem).toBe('Despesa lançada');

    vi.advanceTimersByTime(5_999);
    expect(useAvisoStore.getState().aviso).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(useAvisoStore.getState().aviso).toBeNull();
  });

  it('um aviso novo substitui o anterior e reinicia a contagem', () => {
    useAvisoStore.getState().mostrar({ mensagem: 'Primeiro' });
    vi.advanceTimersByTime(4_000);
    useAvisoStore.getState().mostrar({ mensagem: 'Segundo' });

    vi.advanceTimersByTime(4_000);
    expect(useAvisoStore.getState().aviso?.mensagem).toBe('Segundo');
    vi.advanceTimersByTime(2_000);
    expect(useAvisoStore.getState().aviso).toBeNull();
  });

  it('cada aviso recebe um identificador próprio', () => {
    useAvisoStore.getState().mostrar({ mensagem: 'A' });
    const primeiro = useAvisoStore.getState().aviso?.id;
    useAvisoStore.getState().mostrar({ mensagem: 'A' });
    expect(useAvisoStore.getState().aviso?.id).not.toBe(primeiro);
  });

  it('fechar tira o aviso e cancela a contagem', () => {
    useAvisoStore.getState().mostrar({ mensagem: 'Despesa lançada' });
    useAvisoStore.getState().fechar();
    expect(useAvisoStore.getState().aviso).toBeNull();

    useAvisoStore.getState().mostrar({ mensagem: 'Outro' });
    vi.advanceTimersByTime(3_000);
    expect(useAvisoStore.getState().aviso?.mensagem).toBe('Outro');
  });
});
