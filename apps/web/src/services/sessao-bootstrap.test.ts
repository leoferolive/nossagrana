import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthSessionStore } from '../stores/auth-session.store';

import { bootstrapSessao, type SessaoRestauravel } from './sessao-bootstrap';

class FakeApiClient implements SessaoRestauravel {
  chamadas = 0;
  constructor(
    private readonly resultado: boolean,
    private readonly tokenRecebido: string | null = null,
  ) {}

  async restaurarSessao(): Promise<boolean> {
    this.chamadas += 1;
    if (this.tokenRecebido) useAuthSessionStore.getState().atualizarAccessToken(this.tokenRecebido);
    return this.resultado;
  }
}

const reiniciar = () => {
  localStorage.clear();
  sessionStorage.clear();
  useAuthSessionStore.setState({ status: 'carregando', accessToken: null, familiaIdAtiva: null });
};

describe('bootstrapSessao (#117)', () => {
  beforeEach(reiniciar);

  it('refresh ok: restaura a sessão em memória e mantém o storage sem token', async () => {
    await bootstrapSessao(new FakeApiClient(true, 'access-restaurado'));

    expect(useAuthSessionStore.getState().status).toBe('autenticado');
    expect(useAuthSessionStore.getState().accessToken).toBe('access-restaurado');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('refresh recusado (401/403): vira anônimo, sem token', async () => {
    await bootstrapSessao(new FakeApiClient(false));

    expect(useAuthSessionStore.getState().status).toBe('anonimo');
    expect(useAuthSessionStore.getState().accessToken).toBeNull();
  });

  it('remove as chaves legadas sem reutilizar o access token antigo', async () => {
    localStorage.setItem(
      'nossagrana.auth.session',
      JSON.stringify({
        accessToken: 'legado-secreto',
        refreshToken: 'r-legado',
        familiaIdAtiva: 'f1',
      }),
    );

    await bootstrapSessao(new FakeApiClient(false));

    expect(localStorage.getItem('nossagrana.auth.session')).toBeNull();
    expect(useAuthSessionStore.getState().accessToken).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain('legado-secreto');
    expect(JSON.stringify({ ...localStorage })).not.toContain('r-legado');
  });

  it('migra só o familiaIdAtiva (não secreto) da chave legada', async () => {
    localStorage.setItem(
      'nossagrana.auth.session',
      JSON.stringify({ accessToken: 'legado-secreto', familiaIdAtiva: 'f1' }),
    );

    await bootstrapSessao(new FakeApiClient(true, 'novo'));

    expect(useAuthSessionStore.getState().familiaIdAtiva).toBe('f1');
  });

  it('chave legada corrompida é removida sem quebrar', async () => {
    localStorage.setItem('nossagrana.auth.session', '{nao-json');
    await bootstrapSessao(new FakeApiClient(false));
    expect(localStorage.getItem('nossagrana.auth.session')).toBeNull();
  });
});
