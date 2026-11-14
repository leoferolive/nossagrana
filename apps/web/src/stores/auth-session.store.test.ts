import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthSessionStore } from './auth-session.store';

const estado = () => useAuthSessionStore.getState();

const tokensNoStorage = (token: string): boolean =>
  [localStorage, sessionStorage].some((storage) =>
    Object.keys(storage).some((chave) => (storage.getItem(chave) ?? '').includes(token)),
  );

describe('useAuthSessionStore (#117)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthSessionStore.setState({ status: 'carregando', accessToken: null, familiaIdAtiva: null });
  });

  it('começa carregando, sem token', () => {
    expect(estado().status).toBe('carregando');
    expect(estado().accessToken).toBeNull();
  });

  it('iniciarSessao guarda o access token só em memória (nada de token no storage)', () => {
    estado().iniciarSessao('segredo-access', '');

    expect(estado().status).toBe('autenticado');
    expect(estado().accessToken).toBe('segredo-access');
    expect(tokensNoStorage('segredo-access')).toBe(false);
  });

  it('refresh rotaciona o token em memória sem tocar no storage', () => {
    estado().iniciarSessao('a1', 'f1');
    estado().atualizarAccessToken('a2-rotacionado');

    expect(estado().accessToken).toBe('a2-rotacionado');
    expect(tokensNoStorage('a2-rotacionado')).toBe(false);
  });

  it('atualizarAccessToken depois do logout é descartado (refresh tardio não recria a sessão)', () => {
    estado().iniciarSessao('a1', 'f1');
    estado().encerrarSessao();
    estado().atualizarAccessToken('tardio');

    expect(estado().accessToken).toBeNull();
    expect(estado().status).toBe('anonimo');
  });

  it('logout limpa memória e a família persistida', () => {
    estado().iniciarSessao('a1', '');
    estado().definirFamiliaAtiva('f1');
    expect(localStorage.getItem('nossagrana.familia-ativa')).toBe('f1');

    estado().encerrarSessao();

    expect(estado().accessToken).toBeNull();
    expect(estado().familiaIdAtiva).toBeNull();
    expect(localStorage.getItem('nossagrana.familia-ativa')).toBeNull();
  });

  it("concluirBootstrap('ok') restaura a família persistida (id não secreto)", () => {
    localStorage.setItem('nossagrana.familia-ativa', 'f9');
    estado().atualizarAccessToken('a-do-refresh');
    estado().concluirBootstrap('ok');

    expect(estado().status).toBe('autenticado');
    expect(estado().familiaIdAtiva).toBe('f9');
  });

  it("concluirBootstrap('sem-sessao') vira anônimo", () => {
    estado().concluirBootstrap('sem-sessao');
    expect(estado().status).toBe('anonimo');
  });

  it("concluirBootstrap('indisponivel') não vira anônimo: guarda o estado para o retry", () => {
    estado().concluirBootstrap('indisponivel');

    expect(estado().status).toBe('indisponivel');
    expect(estado().accessToken).toBeNull();
  });

  it('tentarNovamente volta a carregando só a partir de indisponivel', () => {
    estado().concluirBootstrap('indisponivel');
    estado().tentarNovamente();
    expect(estado().status).toBe('carregando');

    estado().concluirBootstrap('sem-sessao');
    estado().tentarNovamente();
    expect(estado().status).toBe('anonimo');
  });

  it('concluirBootstrap não ressuscita uma sessão encerrada durante o bootstrap', () => {
    estado().atualizarAccessToken('a');
    estado().encerrarSessao();
    estado().concluirBootstrap('ok');

    expect(estado().status).toBe('anonimo');
    expect(estado().accessToken).toBeNull();
  });
});
