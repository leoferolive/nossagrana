/**
 * Autenticação do navegador nos testes E2E (#117).
 *
 * O access token vive só em memória e o refresh token só no cookie HttpOnly: não há mais
 * sessão para injetar no localStorage. O login é feito pelo `page.request`, que compartilha
 * o cookie jar do contexto do navegador; no `page.goto` seguinte o bootstrap do app restaura
 * a sessão por `POST /api/auth/refresh` usando esse cookie.
 */
import type { Page } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const CSRF_HEADER = { 'x-nossagrana-csrf': '1' };
const TOURS = ['dashboard', 'extrato', 'historico', 'orcamento', 'configuracoes', 'perfil'];

interface Credenciais {
  email: string;
  password: string;
}

/** Faz login no contexto do navegador (grava o cookie de refresh) sem passar pela UI. */
async function loginNoContexto(page: Page, { email, password }: Credenciais): Promise<void> {
  const resposta = await page.request.post(`${API_URL}/api/auth/login`, {
    headers: CSRF_HEADER,
    data: { email, senha: password },
  });
  if (!resposta.ok()) {
    throw new Error(`Login E2E falhou: status ${resposta.status()} para ${email}`);
  }
}

/**
 * Autentica pelo cookie e recarrega o app. `familiaId` é o id não secreto da família ativa
 * (único dado persistido); sem ele o app cai no onboarding. Os tours são suprimidos.
 */
export async function abrirAppAutenticado(
  page: Page,
  credenciais: Credenciais,
  familiaId = '',
): Promise<void> {
  await loginNoContexto(page, credenciais);
  await page.goto('/');
  await page.evaluate(
    ([fid, tours]) => {
      if (fid) localStorage.setItem('nossagrana.familia-ativa', fid);
      for (const key of tours) localStorage.setItem(`tour-${key}`, 'true');
    },
    [familiaId, TOURS] as const,
  );
  await page.reload();
}

/** Garante que nenhum segredo foi parar no storage do navegador. */
export async function storageSemToken(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const valores = [localStorage, sessionStorage].flatMap((s) =>
      Object.keys(s).map((k) => s.getItem(k) ?? ''),
    );
    return !valores.some((v) => /eyJ[\w-]+\.[\w-]+\./.test(v) || v.includes('accessToken'));
  });
}
