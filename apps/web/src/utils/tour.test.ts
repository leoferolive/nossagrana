import { afterEach, describe, expect, it, vi } from 'vitest';

import { TOUR_DE_BOAS_VINDAS, jaViuTour, marcarTourComoVisto, reabrirTour } from './tour';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('tour', () => {
  it('a chave do tour de boas-vindas é nova, diferente das dos tours antigos', () => {
    expect(TOUR_DE_BOAS_VINDAS).toBe('boas-vindas');
  });

  it('um tour que ninguém marcou ainda não foi visto', () => {
    expect(jaViuTour(TOUR_DE_BOAS_VINDAS)).toBe(false);
  });

  it('marcar como visto grava a chave tour-<nome> e passa a valer como visto', () => {
    marcarTourComoVisto(TOUR_DE_BOAS_VINDAS);
    expect(localStorage.getItem('tour-boas-vindas')).toBe('true');
    expect(jaViuTour(TOUR_DE_BOAS_VINDAS)).toBe(true);
  });

  it('reabrir apaga a marca e o tour volta a valer como não visto', () => {
    marcarTourComoVisto(TOUR_DE_BOAS_VINDAS);
    reabrirTour(TOUR_DE_BOAS_VINDAS);
    expect(jaViuTour(TOUR_DE_BOAS_VINDAS)).toBe(false);
  });

  it('as chaves dos tours antigos não contam como visto o tour novo', () => {
    for (const antigo of [
      'dashboard',
      'extrato',
      'relatorios',
      'orcamento',
      'historico',
      'perfil',
    ]) {
      localStorage.setItem(`tour-${antigo}`, 'true');
    }
    expect(jaViuTour(TOUR_DE_BOAS_VINDAS)).toBe(false);
  });

  it('sem acesso ao armazenamento, o tour aparece e marcar não quebra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(jaViuTour(TOUR_DE_BOAS_VINDAS)).toBe(false);
    expect(() => marcarTourComoVisto(TOUR_DE_BOAS_VINDAS)).not.toThrow();
    expect(() => reabrirTour(TOUR_DE_BOAS_VINDAS)).not.toThrow();
  });
});
