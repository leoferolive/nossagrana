import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChipsDeData } from './chips-de-data';

beforeEach(() => {
  // Só o Date é falso, para não travar as esperas da Testing Library.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const pressionado = (nome: RegExp) =>
  screen.getByRole('button', { name: nome }).getAttribute('aria-pressed');

describe('ChipsDeData', () => {
  it('Hoje fica selecionado quando a data é a de hoje', () => {
    render(<ChipsDeData data="2026-11-17" onChange={vi.fn()} />);
    expect(pressionado(/^hoje$/i)).toBe('true');
    expect(pressionado(/^ontem$/i)).toBe('false');
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument();
  });

  it('Ontem avisa a data de ontem', () => {
    const onChange = vi.fn();
    render(<ChipsDeData data="2026-11-17" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^ontem$/i }));
    expect(onChange).toHaveBeenCalledWith('2026-11-16');
  });

  it('Ontem em 1º de janeiro é 31 de dezembro do ano anterior', () => {
    vi.setSystemTime(new Date('2027-01-01T15:00:00Z'));
    const onChange = vi.fn();
    render(<ChipsDeData data="2027-01-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^ontem$/i }));
    expect(onChange).toHaveBeenCalledWith('2026-12-31');
  });

  it('depois das 21h em São Paulo, Hoje ainda é o dia local e não o dia seguinte em UTC', () => {
    vi.setSystemTime(new Date('2026-11-15T02:11:00Z')); // 14/11 às 23:11 em São Paulo
    const onChange = vi.fn();
    render(<ChipsDeData data="2026-11-14" onChange={onChange} />);
    expect(pressionado(/^hoje$/i)).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^ontem$/i }));
    expect(onChange).toHaveBeenCalledWith('2026-11-13');
  });

  it('"Outra data" mostra o campo de data, e escolher uma data avisa', () => {
    const onChange = vi.fn();
    render(<ChipsDeData data="2026-11-17" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /outra data/i }));
    const campo = screen.getByLabelText('Data');
    fireEvent.change(campo, { target: { value: '2026-10-05' } });

    expect(onChange).toHaveBeenCalledWith('2026-10-05');
  });

  it('uma data que não é hoje nem ontem abre em "Outra data" e o chip mostra a data', () => {
    render(<ChipsDeData data="2026-10-05" onChange={vi.fn()} />);

    expect(pressionado(/outra data/i)).toBe('true');
    expect(screen.getByRole('button', { name: /outra data/i })).toHaveTextContent('05/10/2026');
    expect(screen.getByLabelText('Data')).toHaveValue('2026-10-05');
    expect(pressionado(/^hoje$/i)).toBe('false');
  });

  it('voltar para Hoje esconde o campo de data', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChipsDeData data="2026-10-05" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^hoje$/i }));
    expect(onChange).toHaveBeenCalledWith('2026-11-17');
    rerender(<ChipsDeData data="2026-11-17" onChange={onChange} />);
    expect(screen.queryByLabelText('Data')).not.toBeInTheDocument();
  });
});
