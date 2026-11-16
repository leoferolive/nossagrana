import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCurrentMonth, shiftMonth } from '../utils/date';

import { CabecalhoAba } from './cabecalho-aba';

afterEach(cleanup);

describe('CabecalhoAba', () => {
  it('mostra o título como heading de nível 1 em 26/800', () => {
    render(<CabecalhoAba titulo="Extrato" />);
    const titulo = screen.getByRole('heading', { level: 1, name: 'Extrato' });
    expect(titulo).toHaveClass('text-[26px]', 'font-extrabold');
  });

  it('sem mês, não mostra a pílula de mês', () => {
    render(<CabecalhoAba titulo="Mais" />);
    expect(screen.queryByRole('button', { name: /mês/i })).not.toBeInTheDocument();
  });

  it('com mês, mostra a pílula e o mês por extenso', () => {
    render(<CabecalhoAba titulo="Extrato" mes="2026-03" onMesChange={vi.fn()} />);
    expect(screen.getByText('Março de 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument();
  });

  it('a seta para trás pede o mês anterior e a seta para frente, o seguinte', () => {
    const onMesChange = vi.fn();
    render(<CabecalhoAba titulo="Extrato" mes="2026-03" onMesChange={onMesChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(onMesChange).toHaveBeenLastCalledWith('2026-02');
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(onMesChange).toHaveBeenLastCalledWith('2026-04');
  });

  it('no mês corrente, a seta para frente fica desabilitada', () => {
    const atual = getCurrentMonth();
    render(<CabecalhoAba titulo="Extrato" mes={atual} onMesChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeEnabled();
  });

  it('em mês passado, a seta para frente fica habilitada', () => {
    render(
      <CabecalhoAba
        titulo="Extrato"
        mes={shiftMonth(getCurrentMonth(), -2)}
        onMesChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeEnabled();
  });

  it('mostra as ações passadas à direita', () => {
    render(<CabecalhoAba titulo="Extrato" acoes={<button type="button">Exportar</button>} />);
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
  });

  it('no desktop o título some (a TopBar já mostra) e a pílula fica à direita', () => {
    render(<CabecalhoAba titulo="Extrato" mes="2026-03" onMesChange={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('md:hidden');
  });
});
