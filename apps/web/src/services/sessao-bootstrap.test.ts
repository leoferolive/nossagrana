import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthSessionStore } from '../stores/auth-session.store';

import type { ResultadoRefresh } from './api-client';
import { bootstrapSessao, type SessaoRestauravel } from './sessao-bootstrap';

class FakeApiClient implements SessaoRestauravel {
  chamadas = 0;
  constructor(
    private readonly resultado: ResultadoRefresh,
    private readonly tokenRecebido: string | null = null,
  ) {}

  async restaurarSessao(): Promise<ResultadoRefresh> {
    this.chamadas += 1;
    if (this.tokenRecebido) useAuthSessionStore.getState().atualizarAccessToken(this.tokenRecebido);
    return this.resultado;
  }
}

class FakeFamilias {
  chamadas = 0;
  constructor(private readonly ids: string[] | Error) {}

  listarIds = async (): Promise<string[]> => {
    this.chamadas += 1;
    if (this.ids instanceof Error) throw this.ids;
    return this.ids;
  };
}

const reiniciar = () => {
  localStorage.clear();
  sessionStorage.clear();
  useAuthSessionStore.setState({ status: 'carregando', accessToken: null, familiaIdAtiva: null });
};
const estado = () => useAuthSessionStore.getState();

describe('bootstrapSessao (#117)', () => {
  beforeEach(reiniciar);

  it('refresh ok: restaura a sessão em memória e mantém o storage sem token', async () => {
    await bootstrapSessao(
      new FakeApiClient('ok', 'access-restaurado'),
      new FakeFamilias([]).listarIds,
    );

    expect(estado().status).toBe('autenticado');
    expect(estado().accessToken).toBe('access-restaurado');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('refresh recusado (401/403): vira anônimo, sem token', async () => {
    await bootstrapSessao(new FakeApiClient('sem-sessao'), new FakeFamilias([]).listarIds);

    expect(estado().status).toBe('anonimo');
    expect(estado().accessToken).toBeNull();
  });

  it('servidor indisponível (5xx/offline/429): estado indisponivel, não o login', async () => {
    await bootstrapSessao(new FakeApiClient('indisponivel'), new FakeFamilias([]).listarIds);

    expect(estado().status).toBe('indisponivel');
  });

  it('tentar de novo após indisponível restaura a sessão', async () => {
    await bootstrapSessao(new FakeApiClient('indisponivel'), new FakeFamilias([]).listarIds);
    estado().tentarNovamente();
    await bootstrapSessao(new FakeApiClient('ok', 'a'), new FakeFamilias([]).listarIds);

    expect(estado().status).toBe('autenticado');
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

    await bootstrapSessao(new FakeApiClient('sem-sessao'), new FakeFamilias([]).listarIds);

    expect(localStorage.getItem('nossagrana.auth.session')).toBeNull();
    expect(estado().accessToken).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain('legado-secreto');
    expect(JSON.stringify({ ...localStorage })).not.toContain('r-legado');
  });

  it('migra só o familiaIdAtiva (não secreto) da chave legada', async () => {
    localStorage.setItem(
      'nossagrana.auth.session',
      JSON.stringify({ accessToken: 'legado-secreto', familiaIdAtiva: 'f1' }),
    );

    await bootstrapSessao(new FakeApiClient('ok', 'novo'), new FakeFamilias(['f1']).listarIds);

    expect(estado().familiaIdAtiva).toBe('f1');
  });

  it('chave legada corrompida é removida sem quebrar', async () => {
    localStorage.setItem('nossagrana.auth.session', '{nao-json');
    await bootstrapSessao(new FakeApiClient('sem-sessao'), new FakeFamilias([]).listarIds);
    expect(localStorage.getItem('nossagrana.auth.session')).toBeNull();
  });

  it('I3: família persistida fora de /familias/minhas é descartada (app vai ao onboarding)', async () => {
    localStorage.setItem('nossagrana.familia-ativa', 'removida');

    await bootstrapSessao(new FakeApiClient('ok', 'a'), new FakeFamilias(['outra']).listarIds);

    expect(estado().status).toBe('autenticado');
    expect(estado().familiaIdAtiva).toBeNull();
    expect(localStorage.getItem('nossagrana.familia-ativa')).toBeNull();
  });

  it('I3: família persistida ainda válida é mantida', async () => {
    localStorage.setItem('nossagrana.familia-ativa', 'f1');

    await bootstrapSessao(new FakeApiClient('ok', 'a'), new FakeFamilias(['f1', 'f2']).listarIds);

    expect(estado().familiaIdAtiva).toBe('f1');
  });

  it('I3: sem família persistida não consulta /familias/minhas', async () => {
    const familias = new FakeFamilias(['f1']);
    await bootstrapSessao(new FakeApiClient('ok', 'a'), familias.listarIds);
    expect(familias.chamadas).toBe(0);
  });

  it('I3: falha ao listar famílias não derruba a sessão nem apaga a família', async () => {
    localStorage.setItem('nossagrana.familia-ativa', 'f1');

    await bootstrapSessao(
      new FakeApiClient('ok', 'a'),
      new FakeFamilias(new Error('rede')).listarIds,
    );

    expect(estado().status).toBe('autenticado');
    expect(estado().familiaIdAtiva).toBe('f1');
  });

  it('I3: listarMinhas pendurado estoura em 5 s, mantém a família e conclui o bootstrap', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('nossagrana.familia-ativa', 'f1');
      const pendurado = () => new Promise<string[]>(() => undefined);

      const boot = bootstrapSessao(new FakeApiClient('ok', 'a'), pendurado);
      await vi.advanceTimersByTimeAsync(5_000);
      await boot;

      expect(estado().status).toBe('autenticado');
      expect(estado().familiaIdAtiva).toBe('f1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('N4: bootstrap chamado duas vezes (StrictMode) com o ApiClient real faz um único fetch', async () => {
    const { ApiClient } = await import('./api-client');
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ accessToken: 'unico' }), { status: 200 }),
    );
    const api = new ApiClient({
      baseUrl: 'http://x',
      fetchFn: fetchMock as unknown as typeof fetch,
      getAccessToken: () => estado().accessToken,
      setAccessToken: (t) => estado().atualizarAccessToken(t),
      clearSession: () => estado().encerrarSessao(),
    });
    const familias = new FakeFamilias([]).listarIds;

    await Promise.all([bootstrapSessao(api, familias), bootstrapSessao(api, familias)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(estado().accessToken).toBe('unico');
  });
});
