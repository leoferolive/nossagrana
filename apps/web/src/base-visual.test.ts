import { describe, expect, it } from 'vitest';

import html from '../index.html?raw';
import tailwindConfig from '../tailwind.config';
import viteConfig from '../vite.config.ts?raw';

import appShell from './components/app-shell.tsx?raw';
import { ALVO_TOQUE_CLASSES, CAMPO_CLASSES } from './components/ui/campo-classes';
import authShell from './components/ui/auth-shell.tsx?raw';
import authContext from './contexts/auth-context.tsx?raw';
import css from './index.css?raw';

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
    // 144px = barra (68px) + "+" (56px) + folga, para o último item rolar acima do "+".
    expect(appShell).toContain('pb-[calc(144px+env(safe-area-inset-bottom))]');
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

/** Devolve o texto de cada tag <input>, <select> e <textarea>, até o `>` que a fecha. */
function tagsDeCampo(conteudo: string): string[] {
  const tags: string[] = [];
  for (const inicio of conteudo.matchAll(/<(input|select|textarea)\b/g)) {
    let profundidade = 0;
    let i = inicio.index;
    for (; i < conteudo.length; i += 1) {
      const c = conteudo[i];
      if (c === '{') profundidade += 1;
      else if (c === '}') profundidade -= 1;
      else if (c === '>' && profundidade === 0) break;
    }
    tags.push(conteudo.slice(inicio.index, i + 1));
  }
  return tags;
}

describe('campos em 16px e alvos de toque com 44px', () => {
  const arquivosComCampo = Object.keys(fontes).filter(
    (caminho) => !caminho.endsWith('.test.tsx') && tagsDeCampo(fonte(caminho)).length > 0,
  );
  const SEM_CAMPO_DE_TEXTO = /type="(radio|checkbox|range)"/;

  it('encontra os arquivos com campos', () => {
    expect(arquivosComCampo.length).toBeGreaterThanOrEqual(12);
  });

  it.each(arquivosComCampo)('%s: nenhum campo de texto usa text-sm ou text-xs', (caminho) => {
    for (const tag of tagsDeCampo(fonte(caminho)).filter((t) => !SEM_CAMPO_DE_TEXTO.test(t))) {
      expect(tag).not.toMatch(/\btext-(sm|xs)\b/);
      expect(tag).toContain('CAMPO_CLASSES');
    }
  });

  it('CAMPO_CLASSES tem fonte de 16px, altura mínima de 44px e anel de foco em success', () => {
    expect(CAMPO_CLASSES).toContain('text-base');
    expect(CAMPO_CLASSES).toContain('min-h-11');
    expect(CAMPO_CLASSES).toContain('focus:ring-2 focus:ring-success');
  });

  it('CAMPO_CLASSES tem estilo de desabilitado e padding vertical (textarea)', () => {
    expect(CAMPO_CLASSES).toContain('disabled:cursor-not-allowed');
    expect(CAMPO_CLASSES).toContain('disabled:bg-surface-hover');
    expect(CAMPO_CLASSES).toContain('disabled:text-text-muted');
    // Compara a classe inteira: procurar só o trecho `py-2` casaria também
    // `py-2.5`, que deixa o campo com 46px em vez de 44.
    const classes = CAMPO_CLASSES.split(' ');
    expect(classes).toContain('py-2');
    expect(classes).not.toContain('py-2.5');
  });

  it('as setas de mês de Lançamentos usam ALVO_TOQUE_CLASSES', () => {
    expect(fonte('./pages/lancamentos-page.tsx')).toContain('ALVO_TOQUE_CLASSES');
  });

  it('o fundo decorativo do auth-shell usa opacidade que existe na escala (/10)', () => {
    expect(authShell).not.toContain('bg-info/8');
  });

  it('ALVO_TOQUE_CLASSES garante 44x44', () => {
    expect(ALVO_TOQUE_CLASSES).toContain('min-h-11');
    expect(ALVO_TOQUE_CLASSES).toContain('min-w-11');
  });

  it.each([
    './components/month-nav.tsx',
    './pages/extrato-page.tsx',
    './pages/categorias-page.tsx',
    './components/transacao-modal.tsx',
    './components/cofrinho-modal.tsx',
    './components/cofrinho-aporte-modal.tsx',
    './components/cofrinho-retirada-modal.tsx',
    './components/cofrinho-encerrar-modal.tsx',
    './components/templates-gerenciar-modal.tsx',
  ])('%s usa ALVO_TOQUE_CLASSES nos controles pequenos', (caminho) => {
    expect(fonte(caminho)).toContain('ALVO_TOQUE_CLASSES');
  });
});

describe('escala de z-index', () => {
  it('o Tailwind define os quatro níveis nomeados, em ordem crescente', () => {
    const zIndex = tailwindConfig.theme?.extend?.zIndex as Record<string, string> | undefined;
    expect(zIndex).toEqual({ barra: '40', lancar: '45', painel: '50', aviso: '60' });
  });

  it.each(Object.keys(fontes).filter((caminho) => !caminho.endsWith('.test.tsx')))(
    '%s não usa z-index numérico nem arbitrário',
    (caminho) => {
      expect(fonte(caminho)).not.toMatch(/\bz-(\d|\[)/);
    },
  );

  it('o "+" do AppShell fica abaixo dos painéis e acima da barra', () => {
    const botao = appShell.slice(appShell.indexOf('aria-label={onVoiceActivate'));
    expect(botao).toContain('z-lancar');
  });

  it('a barra inferior usa z-barra', () => {
    expect(fonte('./components/bottom-nav.tsx')).toContain('z-barra');
  });
});

describe('alvo de toque de 44px garantido pela regra base', () => {
  const base = css.slice(css.indexOf('@layer base'));

  it('button, tab, select e summary têm altura mínima de 44px', () => {
    expect(base).toMatch(
      /button,\s*\[role='tab'\],\s*select,\s*summary\s*\{[^}]*min-height:\s*2\.75rem/,
    );
  });

  it('button tem largura mínima de 44px', () => {
    expect(base).toMatch(/button\s*\{[^}]*min-width:\s*2\.75rem/);
  });

  it('label de rádio ou checkbox tem altura mínima de 44px', () => {
    expect(base).toMatch(
      /label:has\(> input\[type='radio'\]\),\s*label:has\(> input\[type='checkbox'\]\)\s*\{[^}]*min-height:\s*2\.75rem/,
    );
  });

  it('a regra base não muda o display dos botões', () => {
    expect(base).not.toMatch(/display:/);
  });
});

describe('service worker com endereços internos', () => {
  const denylist = /navigateFallbackDenylist:\s*\[([^\]]*)\]/.exec(viteConfig)?.[1] ?? '';

  it('o retorno de navegação para index.html deixa /api/ de fora', () => {
    expect(denylist).toMatch(/\^\\\/api\\\//);
  });

  it('o retorno de navegação para index.html deixa /health de fora', () => {
    expect(denylist).toMatch(/\^\\\/health/);
  });
});
