import { describe, expect, it } from 'vitest';

const paginas = import.meta.glob<string>('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const fontesDasPaginas = Object.entries(paginas).filter(
  ([caminho]) => !caminho.endsWith('.test.tsx'),
);

describe('um único tour de boas-vindas', () => {
  it('encontra as páginas', () => {
    expect(fontesDasPaginas.length).toBeGreaterThanOrEqual(15);
  });

  it.each(fontesDasPaginas.filter(([caminho]) => caminho !== './dashboard-page.tsx'))(
    '%s não monta tour',
    (_caminho, fonte) => {
      expect(fonte).not.toContain('FirstTimeTour');
      expect(fonte).not.toContain('TourBoasVindas');
      expect(fonte).not.toContain('first-time-tour');
    },
  );

  it('o Início monta o tour de boas-vindas', () => {
    expect(paginas['./dashboard-page.tsx']).toContain('<TourBoasVindas />');
  });
});
