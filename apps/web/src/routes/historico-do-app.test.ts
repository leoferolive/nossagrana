import { afterEach, describe, expect, it } from 'vitest';

import { temEntradaAnteriorDoApp } from './historico-do-app';

const simularEstado = (estado: unknown) => window.history.replaceState(estado, '');

afterEach(() => simularEstado(null));

describe('temEntradaAnteriorDoApp', () => {
  it('idx 0: primeira entrada do app, mesmo substituída (key já não é "default")', () => {
    simularEstado({ idx: 0 });

    expect(temEntradaAnteriorDoApp('abc123')).toBe(false);
  });

  it('idx 2: há entrada anterior do app, mesmo com key "default"', () => {
    simularEstado({ idx: 2 });

    expect(temEntradaAnteriorDoApp('default')).toBe(true);
  });

  it('sem idx, usa a key: "default" é a primeira entrada', () => {
    simularEstado(null);

    expect(temEntradaAnteriorDoApp('default')).toBe(false);
  });

  it('sem idx, usa a key: qualquer outra indica entrada anterior', () => {
    simularEstado({ usr: null });

    expect(temEntradaAnteriorDoApp('k1')).toBe(true);
  });
});
