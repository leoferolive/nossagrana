import { describe, expect, it } from 'vitest';

import html from '../index.html?raw';
import tailwindConfig from '../tailwind.config';
import viteConfig from '../vite.config.ts?raw';

import appShell from './components/app-shell.tsx?raw';
import authShell from './components/ui/auth-shell.tsx?raw';
import authContext from './contexts/auth-context.tsx?raw';

const fontes = import.meta.glob<string>(['./components/**/*.tsx', './pages/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

function fonte(caminho: string): string {
  const conteudo = fontes[caminho];
  if (conteudo === undefined) throw new Error(`Arquivo ${caminho} não encontrado`);
  return conteudo;
}

describe('documento base (index.html e manifest)', () => {
  it('o <body> não força o fundo slate do tema antigo', () => {
    expect(html).not.toContain('bg-slate-50');
  });

  it('theme-color usa o fundo da paleta clara', () => {
    expect(html).toMatch(/<meta name="theme-color" content="#F2F4EF"/i);
  });

  it('viewport cobre a tela toda para expor a área segura do iPhone', () => {
    expect(html).toContain('viewport-fit=cover');
  });

  it('manifest usa o fundo da paleta clara', () => {
    expect(viteConfig).toMatch(/theme_color: '#F2F4EF'/i);
    expect(viteConfig).toMatch(/background_color: '#F2F4EF'/i);
  });
});

describe('área segura do iPhone', () => {
  it('a classe pb-safe passa a existir no Tailwind', () => {
    const spacing = tailwindConfig.theme?.extend?.spacing as Record<string, string> | undefined;
    expect(spacing?.safe).toBe('env(safe-area-inset-bottom)');
  });

  it('o AppShell reserva a barra mais a área segura e sobe o "+" na mesma medida', () => {
    expect(appShell).toContain('pb-[calc(68px+env(safe-area-inset-bottom))]');
    expect(appShell).toContain('bottom-[calc(80px+env(safe-area-inset-bottom))]');
  });

  it.each([
    './components/transacao-modal.tsx',
    './components/voice-recording-sheet.tsx',
    './components/cofrinho-modal.tsx',
    './components/cofrinho-aporte-modal.tsx',
    './components/cofrinho-retirada-modal.tsx',
    './components/cofrinho-encerrar-modal.tsx',
    './components/templates-gerenciar-modal.tsx',
  ])('o painel de baixo para cima %s soma a área segura ao padding inferior', (caminho) => {
    expect(fonte(caminho)).toContain('env(safe-area-inset-bottom)');
  });
});

describe('altura do shell', () => {
  const PAGINAS_FORA_DO_SHELL = [
    './pages/login-page.tsx',
    './pages/sign-up-page.tsx',
    './pages/onboarding-page.tsx',
    './pages/familia-selector-page.tsx',
  ];
  const paginasDoShell = Object.keys(fontes).filter(
    (caminho) =>
      caminho.startsWith('./pages/') &&
      !caminho.endsWith('.test.tsx') &&
      !PAGINAS_FORA_DO_SHELL.includes(caminho),
  );

  it('encontra as páginas do shell', () => {
    expect(paginasDoShell.length).toBeGreaterThanOrEqual(15);
  });

  it.each(paginasDoShell)(
    '%s não usa min-h-screen (soma a barra e cria rolagem fantasma)',
    (caminho) => {
      expect(fonte(caminho)).not.toContain('min-h-screen');
    },
  );

  it('o AppShell ocupa a altura visível e só o <main> rola', () => {
    expect(appShell).toMatch(/className="flex h-dvh overflow-hidden/);
    expect(appShell).toMatch(/<main className="[^"]*overflow-y-auto/);
  });

  it('telas fora do shell usam a altura visível (dvh), não a do layout (vh)', () => {
    for (const conteudo of [authShell, authContext]) {
      expect(conteudo).toContain('min-h-dvh');
      expect(conteudo).not.toContain('min-h-screen');
    }
  });
});
