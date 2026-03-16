/**
 * HTTP client helper for E2E tests.
 *
 * Uses the native fetch API to call the NossaGrana API directly, bypassing the
 * browser UI. This is useful for setting up and tearing down test data.
 *
 * Routes that require familia scope expect the `x-familia-id` header.
 */

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

// ─── Response types ────────────────────────────────────────────────────────────

interface User {
  id: string;
  nome: string;
  email: string;
}

interface RegisterResponse {
  user: User & { dataCriacao: string };
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface Familia {
  id: string;
  nome: string;
  dataCriacao: string;
}

interface FamiliaResponse {
  familia: Familia;
}

interface Categoria {
  id: string;
  familiaId: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  criadoPor: string;
  criadoEm: string;
}

interface CategoriaResponse {
  categoria: Categoria;
}

interface MetodoPagamento {
  id: string;
  familiaId: string;
  nome: string;
  tipo: string;
  dataFechamento: number | null;
  dataVencimento: number | null;
  usuarioDonoId: string;
  ativo: boolean;
  criadoEm: string;
}

interface MetodoPagamentoResponse {
  metodoPagamento: MetodoPagamento;
}

interface Transacao {
  id: string;
  familiaId: string;
  tipo: string;
  valor: string;
  categoriaId: string;
  descricao: string | null;
  data: string;
  mesReferencia: string;
  metodoPagamentoId: string | null;
  usuarioRegistrouId: string;
  recorrente: boolean;
  frequencia: string | null;
  dataFimRecorrencia: string | null;
  parcelado: boolean;
  numeroParcelas: number | null;
  parcelaAtual: number | null;
  valorTotal: string | null;
  valorParcela: string | null;
  transacaoPaiId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

interface TransacaoResponse {
  transacao: Transacao;
}

// ─── Input types ───────────────────────────────────────────────────────────────

interface RegisterInput {
  nome: string;
  email: string;
  senha: string;
}

interface LoginInput {
  email: string;
  senha: string;
}

interface CategoriaInput {
  nome: string;
  tipo: 'receita' | 'despesa';
}

interface MetodoPagamentoInput {
  nome: string;
  tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
  dataFechamento?: number | null;
  dataVencimento?: number | null;
}

interface TransacaoInput {
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  data: string;
  descricao?: string | null;
  metodoPagamentoId?: string | null;
  parcelado?: boolean;
  numeroParcelas?: number | null;
  recorrente?: boolean;
  frequencia?: 'mensal' | 'semanal' | 'quinzenal' | null;
  dataFimRecorrencia?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  options: {
    token?: string;
    familiaId?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  if (options.familiaId) {
    headers['x-familia-id'] = options.familiaId;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let message = `API ${method} ${path} failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody.message) {
        message += `: ${errorBody.message}`;
      }
    } catch {
      // ignore JSON parse errors on error bodies
    }
    throw new Error(message);
  }

  // 204 No Content — return empty object cast to T
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Returns the created user. Does NOT return tokens — use `login` to obtain them.
 */
export async function register(data: RegisterInput): Promise<RegisterResponse> {
  return request<RegisterResponse>('POST', '/api/auth/register', { body: data });
}

/**
 * POST /auth/login
 * Returns accessToken and refreshToken. Does NOT return user data.
 */
export async function login(data: LoginInput): Promise<LoginResponse> {
  return request<LoginResponse>('POST', '/api/auth/login', { body: data });
}

/**
 * POST /familias
 * Creates a new familia for the authenticated user.
 * Requires a valid access token.
 */
export async function criarFamilia(token: string, data: { nome: string }): Promise<Familia> {
  const response = await request<FamiliaResponse>('POST', '/api/familias', {
    token,
    body: data,
  });
  return response.familia;
}

/**
 * POST /transacoes
 * Creates a new transacao within the specified familia.
 * Requires a valid access token and an active familia context (x-familia-id header).
 */
export async function criarTransacao(
  token: string,
  familiaId: string,
  data: TransacaoInput,
): Promise<Transacao> {
  const response = await request<TransacaoResponse>('POST', '/api/transacoes', {
    token,
    familiaId,
    body: data,
  });
  return response.transacao;
}

/**
 * POST /categorias
 * Creates a new categoria within the specified familia.
 * Requires a valid access token and an active familia context (x-familia-id header).
 */
export async function criarCategoria(
  token: string,
  familiaId: string,
  data: CategoriaInput,
): Promise<Categoria> {
  const response = await request<CategoriaResponse>('POST', '/api/categorias', {
    token,
    familiaId,
    body: data,
  });
  return response.categoria;
}

/**
 * POST /metodos-pagamento
 * Creates a new metodo de pagamento within the specified familia.
 * Requires a valid access token and an active familia context (x-familia-id header).
 */
export async function criarMetodoPagamento(
  token: string,
  familiaId: string,
  data: MetodoPagamentoInput,
): Promise<MetodoPagamento> {
  const response = await request<MetodoPagamentoResponse>('POST', '/api/metodos-pagamento', {
    token,
    familiaId,
    body: data,
  });
  return response.metodoPagamento;
}

/**
 * DELETE /auth/account
 * Deletes the authenticated user's account. Used for cleanup after tests.
 * Returns void (204 No Content).
 */
export async function deleteAccount(token: string): Promise<void> {
  await request<void>('DELETE', '/api/auth/account', { token });
}
