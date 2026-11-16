import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { abaDoCaminho } from '../routes/caminhos';

import { BottomNav } from './bottom-nav';

const renderBarra = (
  caminho: string,
  props: { onLancar?: () => void; onSegurarLancar?: () => void } = {},
) =>
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <BottomNav
        abaAtiva={abaDoCaminho(caminho)}
        onLancar={props.onLancar ?? vi.fn()}
        onSegurarLancar={props.onSegurarLancar}
      />
    </MemoryRouter>,
  );

describe('BottomNav', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('tem Início, Extrato, Lançar, Planejar e Mais, nesta ordem', () => {
    renderBarra('/');
    const barra = screen.getByRole('navigation', { name: 'Navegação principal' });
    const itens = Array.from(barra.querySelectorAll('a, button'));
    expect(itens.map((i) => i.textContent)).toEqual(['Início', 'Extrato', '', 'Planejar', 'Mais']);
    expect(itens[2]).toHaveAccessibleName('Lançar');
  });

  it('as quatro abas são links para os endereços certos', () => {
    renderBarra('/');
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Extrato' })).toHaveAttribute('href', '/extrato');
    expect(screen.getByRole('link', { name: 'Planejar' })).toHaveAttribute('href', '/planejar');
    expect(screen.getByRole('link', { name: 'Mais' })).toHaveAttribute('href', '/mais');
  });

  it('em tela de segundo nível de Mais, a aba Mais fica marcada', () => {
    renderBarra('/mais/categorias');
    expect(screen.getByRole('link', { name: 'Mais' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Planejar' })).not.toHaveAttribute('aria-current');
  });

  it('em detalhe de cofrinho, a aba Planejar fica marcada', () => {
    renderBarra('/planejar/cofrinhos/c1');
    expect(screen.getByRole('link', { name: 'Planejar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Mais' })).not.toHaveAttribute('aria-current');
  });

  it('o botão Lançar chama onLancar no toque curto', () => {
    const onLancar = vi.fn();
    renderBarra('/', { onLancar });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }));
    expect(onLancar).toHaveBeenCalledOnce();
  });

  it('segurar o Lançar por 500ms chama onSegurarLancar e não abre o painel', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onLancar = vi.fn();
    const onSegurarLancar = vi.fn();
    renderBarra('/', { onLancar, onSegurarLancar });
    const botao = screen.getByRole('button', { name: 'Lançar' });
    fireEvent.mouseDown(botao, { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(500);
    fireEvent.click(botao);
    expect(onSegurarLancar).toHaveBeenCalledOnce();
    expect(onLancar).not.toHaveBeenCalled();
  });

  it('se o dedo sai do botão depois do toque longo, o toque seguinte volta a abrir o painel', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onLancar = vi.fn();
    renderBarra('/', { onLancar, onSegurarLancar: vi.fn() });
    const botao = screen.getByRole('button', { name: 'Lançar' });
    fireEvent.mouseDown(botao, { clientX: 1, clientY: 1 });
    vi.advanceTimersByTime(500);
    fireEvent.mouseUp(botao); // sem clique: o dedo saiu do botão
    vi.advanceTimersByTime(500);
    fireEvent.click(botao);
    expect(onLancar).toHaveBeenCalledOnce();
  });

  it('o "+" tem 58px, fundo success e anel de 6px na cor do fundo', () => {
    renderBarra('/');
    const botao = screen.getByRole('button', { name: 'Lançar' });
    expect(botao).toHaveClass('h-[58px]', 'w-[58px]', 'bg-success', 'ring-[6px]', 'ring-bg');
  });

  it('mexer mais de 10px antes de 500ms cancela o toque longo', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onSegurarLancar = vi.fn();
    renderBarra('/', { onSegurarLancar });
    const botao = screen.getByRole('button', { name: 'Lançar' });
    fireEvent.mouseDown(botao, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(botao, { clientX: 120, clientY: 100 });
    vi.advanceTimersByTime(500);
    expect(onSegurarLancar).not.toHaveBeenCalled();
  });

  it('a barra usa z-barra e o botão Lançar usa z-lancar (abaixo dos painéis)', () => {
    renderBarra('/');
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toHaveClass('z-barra');
    expect(screen.getByRole('button', { name: 'Lançar' })).toHaveClass('z-lancar');
  });

  it('todos os itens têm alvo de toque de 44px', () => {
    renderBarra('/');
    for (const nome of ['Início', 'Extrato', 'Planejar', 'Mais']) {
      expect(screen.getByRole('link', { name: nome })).toHaveClass('min-h-11');
    }
  });
});
