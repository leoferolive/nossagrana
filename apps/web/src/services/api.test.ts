import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

// Mock do axios para evitar chamadas de rede
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    default: {
      ...actual.default,
      create: vi.fn(),
    },
  };
});

describe('api service', () => {
  let mockAxiosInstance: {
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAxiosInstance = {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);

    localStorage.clear();
    useAuthStore.getState().logout();

    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cria a instância axios com baseURL da variável de ambiente', async () => {
    await import('./api');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: expect.any(String),
      }),
    );
  });

  it('registra interceptor de request', async () => {
    await import('./api');
    expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledOnce();
  });

  it('registra interceptor de response para refresh automático', async () => {
    await import('./api');
    expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledOnce();
  });

  it('o interceptor de request adiciona Authorization header quando há accessToken', async () => {
    useAuthStore.getState().setAuth({ id: '1', nome: 'Leo', email: 'leo@test.com' }, 'my-token', 'refresh');

    await import('./api');

    const [requestInterceptor] = vi.mocked(mockAxiosInstance.interceptors.request.use).mock.calls[0] as [
      (config: { headers: Record<string, string> }) => { headers: Record<string, string> },
    ];

    const config = { headers: {} };
    const result = requestInterceptor(config);

    expect(result.headers['Authorization']).toBe('Bearer my-token');
  });
});
