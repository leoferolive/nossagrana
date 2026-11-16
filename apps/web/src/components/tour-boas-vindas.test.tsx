import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TourBoasVindas } from './tour-boas-vindas';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const avancar = () => fireEvent.click(screen.getByRole('button', { name: /próximo/i }));

describe('TourBoasVindas', () => {
  it('abre no primeiro acesso com o passo Início', () => {
    render(<TourBoasVindas />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Início' })).toBeInTheDocument();
    expect(
      screen.getByText('Aqui você vê o saldo do mês, quanto entrou e quanto saiu.'),
    ).toBeInTheDocument();
  });

  it('tem quatro passos: Início, Lançar, Planejar e Mais, com os textos combinados', () => {
    render(<TourBoasVindas />);
    avancar();
    expect(screen.getByRole('heading', { name: 'Lançar' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Toque no + para lançar uma despesa ou receita. Segure para lançar por voz.',
      ),
    ).toBeInTheDocument();
    avancar();
    expect(screen.getByRole('heading', { name: 'Planejar' })).toBeInTheDocument();
    expect(
      screen.getByText('Contas do mês, limites por categoria, faturas e cofrinhos ficam aqui.'),
    ).toBeInTheDocument();
    avancar();
    expect(screen.getByRole('heading', { name: 'Mais' })).toBeInTheDocument();
    expect(
      screen.getByText('Relatórios, família, cadastros e a sua conta ficam aqui.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /próximo/i })).not.toBeInTheDocument();
  });

  it('concluir fecha o tour e grava a marca de visto', () => {
    render(<TourBoasVindas />);
    avancar();
    avancar();
    avancar();
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('tour-boas-vindas')).toBe('true');
  });

  it('pular fecha o tour e grava a marca de visto', () => {
    render(<TourBoasVindas />);
    fireEvent.click(screen.getByRole('button', { name: /pular/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('tour-boas-vindas')).toBe('true');
  });

  it('não abre de novo para quem já viu', () => {
    localStorage.setItem('tour-boas-vindas', 'true');
    render(<TourBoasVindas />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre uma vez para quem só tem as marcas dos tours antigos', () => {
    for (const antigo of [
      'dashboard',
      'extrato',
      'relatorios',
      'orcamento',
      'historico',
      'perfil',
    ]) {
      localStorage.setItem(`tour-${antigo}`, 'true');
    }
    render(<TourBoasVindas />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pular/i }));
    cleanup();
    render(<TourBoasVindas />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
