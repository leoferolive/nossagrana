import { useEffect, useRef, useState } from 'react';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface OpcoesDaArmadilha {
  /** Chamado no Escape; sem ele o Escape não faz nada. */
  aoEscape?: () => void;
  /**
   * Para onde o foco volta ao sair. Sem ele, volta a quem tinha o foco antes de abrir. Passe o
   * botão que abriu quando o navegador pode não tê-lo focado no clique (Safari não foca botões).
   */
  devolverPara?: HTMLElement | null;
}

const focaveisDe = (raiz: HTMLElement): HTMLElement[] =>
  Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter((el) => !el.closest('[inert]'));

/** Tab e Shift+Tab dão a volta dentro de `raiz`, sem deixar o foco sair. */
const prenderTab = (raiz: HTMLElement, e: KeyboardEvent): void => {
  const itens = focaveisDe(raiz);
  e.preventDefault();
  if (itens.length === 0) return;
  const primeiro = itens[0];
  const ultimo = itens[itens.length - 1];
  const atual = document.activeElement;
  const dentro = atual instanceof HTMLElement && raiz.contains(atual);
  if (e.shiftKey) {
    if (!dentro || atual === primeiro) ultimo.focus();
    else itens[itens.indexOf(atual) - 1]?.focus();
  } else if (!dentro || atual === ultimo) {
    primeiro.focus();
  } else {
    itens[itens.indexOf(atual) + 1]?.focus();
  }
};

/**
 * Prende o foco do teclado num painel (diálogo): ao abrir leva o foco para dentro (se ainda não
 * está), Tab e Shift+Tab dão a volta, Escape avisa, e ao sair o foco volta a quem o tinha.
 * `aria-modal` sozinho não torna o fundo inerte. Devolve o `ref` do elemento que contém o painel.
 */
export const useArmadilhaDeFoco = <T extends HTMLElement>({
  aoEscape,
  devolverPara,
}: OpcoesDaArmadilha = {}) => {
  const raiz = useRef<T>(null);
  // Lido na primeira renderização, antes de qualquer efeito (inclusive o de um campo filho que
  // se foca sozinho) mover o foco.
  const [origem] = useState(() => devolverPara ?? document.activeElement);
  const escape = useRef(aoEscape);
  useEffect(() => {
    escape.current = aoEscape;
  });

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    if (!el.contains(document.activeElement)) focaveisDe(el)[0]?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      // Um painel dentro de outro trata a tecla primeiro; o de fora não age de novo.
      if (e.defaultPrevented) return;
      if (e.key === 'Tab') prenderTab(el, e);
      else if (e.key === 'Escape' && escape.current) {
        e.preventDefault();
        escape.current();
      }
    };
    el.addEventListener('keydown', aoTeclar);
    return () => {
      el.removeEventListener('keydown', aoTeclar);
      if (origem instanceof HTMLElement && origem.isConnected) origem.focus();
    };
  }, [origem]);

  return raiz;
};
