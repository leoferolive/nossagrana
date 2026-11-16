/**
 * Autenticação do navegador nos testes E2E (#117).
 *
 * O access token vive só em memória e o refresh token só no cookie HttpOnly: não há mais
 * sessão para injetar no localStorage. O login já foi feito pela fixture `authContext` (uma
 * vez por teste, por causa do limite de 5 logins por minuto); aqui só se entrega ao navegador
 * o cookie de refresh que esse login gerou. No `page.goto` seguinte o bootstrap do app restaura
 * a sessão por `POST /api/auth/refresh` usando esse cookie.
 *
 * O refresh é rotativo: o primeiro carregamento troca o cookie. Por isso `abrirAppAutenticado`
 * roda uma vez por teste; para recarregar ou voltar ao Início depois, use `page.goto`/`reload`,
 * que levam o cookie já rotacionado. Reinjetar o cookie original seria reuso de token e
 * revogaria a sessão.
 */
import type { Page } from '@playwright/test';

import type { CookieDeRefresh } from './api-client.js';

export const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const CAMINHO_DO_COOKIE = '/api/auth';

/** Chave do tour de boas-vindas no localStorage (`utils/tour.ts` do app: prefixo `tour-`). */
const CHAVE_DO_TOUR = 'tour-boas-vindas';

interface SessaoDoLogin {
  refreshCookie: CookieDeRefresh | null;
}

/**
 * Marca o tour de boas-vindas como visto em toda página do contexto, antes do app rodar. A
 * fixture automática `tourSuprimido` chama isto em todo teste: o login pela interface e o fim do
 * onboarding também caem no Início, e o tour (`role="dialog"`) confundiria os testes de painel.
 */
export async function suprimirTour(page: Page): Promise<void> {
  await page.context().addInitScript((chave) => {
    try {
      localStorage.setItem(chave, 'true');
    } catch {
      // Páginas sem armazenamento (about:blank) não têm tour para suprimir.
    }
  }, CHAVE_DO_TOUR);
}

async function entregarCookieDeRefresh(page: Page, cookie: CookieDeRefresh): Promise<void> {
  // O cookie pertence ao host que o navegador acessa (o app repassa /api à API), não à porta.
  await page.context().addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      domain: new URL(BASE_URL).hostname,
      path: CAMINHO_DO_COOKIE,
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
    },
  ]);
}

/**
 * Entrega a sessão do login ao navegador e abre o app. `familiaId` é o id não secreto da
 * família ativa (único dado persistido); sem ele o app cai nas boas-vindas.
 */
export async function abrirAppAutenticado(
  page: Page,
  sessao: SessaoDoLogin,
  familiaId = '',
): Promise<void> {
  if (!sessao.refreshCookie) {
    throw new Error('Login E2E sem cookie de refresh: a API não enviou o Set-Cookie esperado');
  }
  await entregarCookieDeRefresh(page, sessao.refreshCookie);
  // Roda antes do app em cada carga; só semeia a família se ainda não houver uma (não sobrescreve
  // a escolha feita durante o teste). Um único goto: o bootstrap faz o refresh uma vez.
  await page.addInitScript((fid) => {
    if (fid && !localStorage.getItem('nossagrana.familia-ativa')) {
      localStorage.setItem('nossagrana.familia-ativa', fid);
    }
  }, familiaId);
  await page.goto('/');
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
