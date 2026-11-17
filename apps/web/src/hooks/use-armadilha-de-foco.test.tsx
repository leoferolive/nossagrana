import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useArmadilhaDeFoco } from './use-armadilha-de-foco';

afterEach(cleanup);

interface CaixaProps {
  aoEscape?: () => void;
  devolverPara?: HTMLElement | null;
  /** Foco já dentro da caixa antes do hook rodar (como o campo de valor do painel). */
  comCampoFocado?: boolean;
}

const Caixa = ({ aoEscape, devolverPara, comCampoFocado }: CaixaProps) => {
  const armadilha = useArmadilhaDeFoco<HTMLDivElement>({ aoEscape, devolverPara });
  return (
    <div {...armadilha}>
      <button>primeiro</button>
      <input aria-label="campo" ref={(el) => void (comCampoFocado && el?.focus())} />
      <button>ultimo</button>
      <button disabled>desabilitado</button>
    </div>
  );
};

const ativo = () => document.activeElement;
const teclar = (key: string, shiftKey = false) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });

describe('useArmadilhaDeFoco', () => {
  it('leva o foco ao primeiro elemento focável ao abrir', () => {
    render(<Caixa />);
    expect(ativo()).toBe(screen.getByRole('button', { name: 'primeiro' }));
  });

  it('mantém o foco que já está dentro da caixa', () => {
    render(<Caixa comCampoFocado />);
    expect(ativo()).toBe(screen.getByLabelText('campo'));
  });

  it('Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último (ignora desabilitado)', () => {
    render(<Caixa />);
    screen.getByRole('button', { name: 'ultimo' }).focus();
    teclar('Tab');
    expect(ativo()).toBe(screen.getByRole('button', { name: 'primeiro' }));

    teclar('Tab', true);
    expect(ativo()).toBe(screen.getByRole('button', { name: 'ultimo' }));
  });

  it('Tab com o foco fora da caixa traz o foco para dentro', () => {
    render(
      <>
        <button>de fora</button>
        <Caixa />
      </>,
    );
    const caixa = screen.getByRole('button', { name: 'primeiro' }).parentElement as HTMLElement;
    screen.getByRole('button', { name: 'de fora' }).focus();
    fireEvent.keyDown(caixa, { key: 'Tab' });
    expect(ativo()).toBe(screen.getByRole('button', { name: 'primeiro' }));
  });

  it('Escape avisa', () => {
    const aoEscape = vi.fn();
    render(<Caixa aoEscape={aoEscape} />);
    teclar('Escape');
    expect(aoEscape).toHaveBeenCalledOnce();
  });

  it('ao sair devolve o foco a quem o tinha antes', () => {
    const abrir = document.createElement('button');
    document.body.append(abrir);
    abrir.focus();
    const { unmount } = render(<Caixa />);
    expect(ativo()).not.toBe(abrir);
    unmount();
    expect(ativo()).toBe(abrir);
    abrir.remove();
  });

  it('ao sair devolve o foco ao elemento indicado, mesmo que o navegador não o tenha focado no clique', () => {
    const indicado = document.createElement('button');
    document.body.append(indicado);
    const { unmount } = render(<Caixa devolverPara={indicado} />);
    unmount();
    expect(ativo()).toBe(indicado);
    indicado.remove();
  });
});
