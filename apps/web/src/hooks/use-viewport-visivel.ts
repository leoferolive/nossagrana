import { useEffect, useState } from 'react';

interface AreaVisivel {
  top: number;
  height: number;
}

const lerAreaVisivel = (): AreaVisivel | null => {
  const viewport = window.visualViewport;
  return viewport ? { top: viewport.offsetTop, height: viewport.height } : null;
};

/**
 * Área da tela que a pessoa enxerga de fato. O teclado virtual encolhe só o `visualViewport`
 * (o `dvh` e o layout seguem inteiros em vários celulares), então um painel preso ao `dvh` deixa
 * o rodapé atrás do teclado. `null` quando o navegador não expõe `visualViewport`.
 */
export const useViewportVisivel = (): AreaVisivel | null => {
  const [area, setArea] = useState(lerAreaVisivel);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const atualizar = () => setArea(lerAreaVisivel());
    viewport.addEventListener('resize', atualizar);
    viewport.addEventListener('scroll', atualizar);
    return () => {
      viewport.removeEventListener('resize', atualizar);
      viewport.removeEventListener('scroll', atualizar);
    };
  }, []);

  return area;
};
