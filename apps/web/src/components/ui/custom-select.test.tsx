import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomSelect } from './custom-select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

afterEach(cleanup);

describe('CustomSelect', () => {
  it('renderiza com label e placeholder', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} label="Categoria" />);
    expect(screen.getByText('Categoria')).toBeInTheDocument();
    expect(screen.getByText('Selecione...')).toBeInTheDocument();
  });

  it('exibe valor selecionado', () => {
    render(<CustomSelect options={OPTIONS} value="b" onChange={vi.fn()} label="Cor" />);
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('abre e fecha dropdown ao clicar', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} aria-label="Test" />);
    const btn = screen.getByRole('combobox', { name: 'Test' });

    fireEvent.click(btn);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('seleciona opção ao clicar', () => {
    const onChange = vi.fn();
    render(<CustomSelect options={OPTIONS} value="" onChange={onChange} aria-label="Test" />);

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Gamma'));

    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('fecha ao clicar fora', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} aria-label="Test" />);

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navega com teclado ArrowDown/ArrowUp e seleciona com Enter', () => {
    const onChange = vi.fn();
    render(<CustomSelect options={OPTIONS} value="" onChange={onChange} aria-label="Test" />);
    const btn = screen.getByRole('combobox');

    // Open with Enter
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Navigate down
    fireEvent.keyDown(btn, { key: 'ArrowDown' });
    fireEvent.keyDown(btn, { key: 'ArrowDown' });

    // Select with Enter
    fireEvent.keyDown(btn, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('fecha com Escape', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} aria-label="Test" />);
    const btn = screen.getByRole('combobox');

    fireEvent.click(btn);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('abre com Space', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} aria-label="Test" />);
    const btn = screen.getByRole('combobox');

    fireEvent.keyDown(btn, { key: ' ' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('highlight ao hover', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} aria-label="Test" />);

    fireEvent.click(screen.getByRole('combobox'));
    const items = screen.getAllByRole('option');
    fireEvent.mouseEnter(items[2]);

    // Option should be highlighted (we can check by class)
    expect(items[2].className).toContain('bg-surface');
  });

  it('ArrowUp não vai abaixo de 0', () => {
    render(<CustomSelect options={OPTIONS} value="" onChange={vi.fn()} aria-label="Test" />);
    const btn = screen.getByRole('combobox');

    fireEvent.keyDown(btn, { key: 'Enter' });
    fireEvent.keyDown(btn, { key: 'ArrowUp' });
    fireEvent.keyDown(btn, { key: 'ArrowUp' });

    // Should not crash, should stay at index 0
    fireEvent.keyDown(btn, { key: 'Enter' });
    // Selecting first option
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
