import { useRef, type MouseEvent as ReactMouseEvent } from 'react';

const ATRASO_MS = 500;
const TOLERANCIA_PX = 10;
const LIMITE_DO_CLIQUE_MS = 400;

/**
 * Distingue toque curto de toque longo num botão. O toque longo dispara `aoSegurar` depois de
 * 500ms parado (mexer mais de 10px cancela) e engole o clique que viria em seguida; sem
 * `aoSegurar` o botão se comporta como um botão comum.
 */
export const useToqueLongo = (aoSegurar?: () => void) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segurou = useRef(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  // Pointer e mouse disparam os dois no desktop; só o primeiro inicia a contagem.
  const pressionado = useRef(false);

  const iniciar = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!aoSegurar || pressionado.current) return;
    pressionado.current = true;
    inicio.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      segurou.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      aoSegurar();
    }, ATRASO_MS);
  };

  const encerrar = () => {
    pressionado.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // Se o dedo saiu do botão depois do toque longo, o clique nunca chega e a marca engoliria
    // o próximo toque de verdade. O clique que vem do mesmo gesto chega em poucos ms.
    if (segurou.current) setTimeout(() => (segurou.current = false), LIMITE_DO_CLIQUE_MS);
  };

  const mover = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!inicio.current || !timer.current) return;
    const dx = e.clientX - inicio.current.x;
    const dy = e.clientY - inicio.current.y;
    if (Math.hypot(dx, dy) > TOLERANCIA_PX) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  /** Chame no `onClick`: devolve `true` quando o clique é o fim de um toque longo e deve ser ignorado. */
  const clique = (e: ReactMouseEvent<HTMLButtonElement>): boolean => {
    if (!segurou.current) return false;
    e.preventDefault();
    segurou.current = false;
    return true;
  };

  return {
    clique,
    props: {
      onPointerDown: iniciar,
      onMouseDown: iniciar,
      onPointerUp: encerrar,
      onMouseUp: encerrar,
      onPointerMove: mover,
      onMouseMove: mover,
      onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => e.preventDefault(),
    },
  };
};
