import { describe, expect, it } from 'vitest';

import css from './index.css?raw';

type Rgb = readonly [number, number, number];

const ESPERADOS: Record<string, string> = {
  bg: '242 244 239',
  panel: '255 255 255',
  sidebar: '242 244 239',
  surface: '236 239 233',
  'surface-hover': '226 230 222',
  'card-alt': '248 249 246',
  border: '217 222 214',
  text: '23 33 28',
  'text-muted': '69 82 74',
  'text-dim': '90 103 95',
  'border-strong': '201 208 200',
  success: '15 107 62',
  'success-strong': '11 83 48',
  primary: '15 107 62',
  danger: '179 38 30',
  warning: '138 90 0',
  info: '31 95 139',
  'accent-soft': '221 235 226',
  'danger-soft': '247 225 222',
  'warning-soft': '246 236 205',
  'warning-fill': '201 138 0',
  'border-soft': '230 234 227',
};

function token(nome: string): Rgb {
  const match = css.match(new RegExp(`--color-${nome}:\\s*(\\d+) (\\d+) (\\d+);`));
  if (!match) throw new Error(`Token --color-${nome} ausente em index.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminancia([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((canal) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contraste(a: Rgb, b: Rgb): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
}

describe('tokens da paleta clara', () => {
  it.each(Object.entries(ESPERADOS))('--color-%s vale %s', (nome, valor) => {
    expect(token(nome).join(' ')).toBe(valor);
  });

  it('não define tema escuro nem variante dark', () => {
    expect(css).not.toMatch(/dark/i);
  });

  describe('contraste mínimo de 4,5:1', () => {
    const fundos = ['bg', 'panel', 'surface', 'card-alt'];
    const textos = ['text', 'text-muted', 'text-dim'];

    for (const texto of textos) {
      for (const fundo of fundos) {
        it(`${texto} sobre ${fundo}`, () => {
          expect(contraste(token(texto), token(fundo))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    for (const fundo of ['success', 'success-strong', 'primary', 'danger', 'warning']) {
      it(`branco sobre ${fundo}`, () => {
        expect(contraste([255, 255, 255], token(fundo))).toBeGreaterThanOrEqual(4.5);
      });
    }

    const pares: ReadonlyArray<readonly [string, string]> = [
      ['success', 'accent-soft'],
      ['danger', 'danger-soft'],
      ['warning', 'warning-soft'],
      ['info', 'panel'],
    ];
    for (const [texto, fundo] of pares) {
      it(`${texto} sobre ${fundo}`, () => {
        expect(contraste(token(texto), token(fundo))).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});
