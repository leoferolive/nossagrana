import { beforeEach, describe, expect, it } from 'vitest';

import { useTransacaoStore } from './transacao.store';

describe('transacao.store > versao', () => {
  beforeEach(() => {
    useTransacaoStore.setState({ versao: 0 });
  });

  it('começa em zero', () => {
    expect(useTransacaoStore.getState().versao).toBe(0);
  });

  it('sinalizarMudanca incrementa a versão a cada chamada', () => {
    useTransacaoStore.getState().sinalizarMudanca();
    useTransacaoStore.getState().sinalizarMudanca();
    expect(useTransacaoStore.getState().versao).toBe(2);
  });
});
