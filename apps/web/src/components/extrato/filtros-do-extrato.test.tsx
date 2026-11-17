import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FiltrosDoExtrato, type FiltroTipo } from './filtros-do-extrato';

afterEach(cleanup);

const Montagem = ({ onExportar }: { onExportar: () => void }) => {
  const [filtro, setFiltro] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState('');
  return (
    <FiltrosDoExtrato
      filtro={filtro}
      onFiltro={setFiltro}
      busca={busca}
      onBusca={setBusca}
      onExportar={onExportar}
    />
  );
};

const montar = (onExportar = vi.fn()) => {
  render(<Montagem onExportar={onExportar} />);
  return onExportar;
};

describe('FiltrosDoExtrato', () => {
  it('mostra os chips Tudo, Saídas e Entradas com Tudo marcado', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Saídas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Entradas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('escolher um chip marca só ele, com fundo success e texto branco', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Saídas' }));
    const saidas = screen.getByRole('button', { name: 'Saídas' });
    expect(saidas).toHaveAttribute('aria-pressed', 'true');
    expect(saidas).toHaveClass('bg-success', 'text-white');
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('tocar no chip marcado de novo não desmarca', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Entradas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entradas' }));
    expect(screen.getByRole('button', { name: 'Entradas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('o campo de busca fica escondido até tocar em Buscar, e recebe o foco', () => {
    montar();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('searchbox', { name: 'Buscar por descrição' })).toHaveFocus();
  });

  it('fechar a busca limpa o texto', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pizza' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('"Exportar CSV" só aparece dentro de "Mais ações" e chama onExportar', () => {
    const onExportar = montar();
    expect(screen.queryByRole('menuitem', { name: 'Exportar CSV' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar CSV' }));
    expect(onExportar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Escape fecha o menu de mais ações', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
