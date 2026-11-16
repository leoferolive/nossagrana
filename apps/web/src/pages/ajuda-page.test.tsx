import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AjudaPage } from './ajuda-page';
import { renderPagina } from '../test/render-pagina';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('AjudaPage', () => {
  it('renderiza título e subtítulo', () => {
    renderPagina(<AjudaPage />);
    expect(screen.getByRole('heading', { name: /ajuda/i })).toBeInTheDocument();
    expect(screen.getByText(/perguntas frequentes sobre o nossagrana/i)).toBeInTheDocument();
  });

  it('mostra as 4 categorias do wireframe', () => {
    renderPagina(<AjudaPage />);
    expect(screen.getByText('Transações')).toBeInTheDocument();
    expect(screen.getByText('Orçamento')).toBeInTheDocument();
    expect(screen.getByText('Família')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('renderiza todas as perguntas do FAQ', () => {
    renderPagina(<AjudaPage />);
    expect(screen.getByText('Como cadastrar uma transação?')).toBeInTheDocument();
    expect(screen.getByText('Como funciona o parcelamento?')).toBeInTheDocument();
    expect(screen.getByText('O que é uma transação recorrente?')).toBeInTheDocument();
    expect(screen.getByText('O que significa o alerta de orçamento?')).toBeInTheDocument();
    expect(screen.getByText('Posso mudar o limite no meio do mês?')).toBeInTheDocument();
    expect(screen.getByText('Como convidar alguém para minha família?')).toBeInTheDocument();
    expect(screen.getByText('Posso editar transações de outros membros?')).toBeInTheDocument();
    expect(screen.getByText('O que é o snapshot mensal?')).toBeInTheDocument();
    expect(screen.getByText("O que significa 'Divergente'?")).toBeInTheDocument();
  });

  it('expande resposta ao clicar na pergunta', () => {
    renderPagina(<AjudaPage />);
    const question = screen.getByText('Como cadastrar uma transação?');
    expect(screen.queryByText(/Nova Transação/i)).not.toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.getByText(/Nova Transação/i)).toBeInTheDocument();
  });

  it('fecha resposta ao clicar novamente na pergunta', () => {
    renderPagina(<AjudaPage />);
    const question = screen.getByText('Como cadastrar uma transação?');
    fireEvent.click(question);
    expect(screen.getByText(/Nova Transação/i)).toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.queryByText(/Nova Transação/i)).not.toBeInTheDocument();
  });

  it('usa ícone › com rotação quando aberto', () => {
    renderPagina(<AjudaPage />);
    const question = screen.getByText('Como cadastrar uma transação?');
    const button = question.closest('button')!;
    const icon = button.querySelector('span:last-child')!;
    expect(icon.textContent).toBe('›');
    expect(icon.className).not.toContain('rotate-90');
    fireEvent.click(question);
    expect(icon.className).toContain('rotate-90');
  });

  it('resposta expandida tem border-left verde', () => {
    renderPagina(<AjudaPage />);
    fireEvent.click(screen.getByText('Como cadastrar uma transação?'));
    const answer = screen.getByText(/Nova Transação/i).closest('div')!;
    expect(answer.className).toContain('border-l-2');
    expect(answer.className).toContain('border-success');
    expect(answer.className).toContain('pl-3');
  });

  it('mostra o título como heading de nível 1 e o Voltar leva a Mais (link direto)', async () => {
    renderPagina(<AjudaPage />, '/mais/ajuda');
    expect(screen.getByRole('heading', { level: 1, name: /ajuda/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/mais$/);
  });

  it('tem separadores entre itens exceto no último de cada seção', () => {
    renderPagina(<AjudaPage />);
    // Transações tem 3 itens, então 2 devem ter border-bottom
    const transacoesHeading = screen.getByText('Transações');
    const card = transacoesHeading.closest('[data-section]')!;
    const items = card.querySelectorAll('[data-faq-item]');
    expect(items.length).toBe(3);
    expect(items[0].className).toContain('border-b');
    expect(items[1].className).toContain('border-b');
    expect(items[2].className).not.toContain('border-b');
  });

  it('"Rever tutorial" reabre o tour de boas-vindas e leva ao Início', () => {
    localStorage.setItem('tour-boas-vindas', 'true');
    renderPagina(<AjudaPage />, '/mais/ajuda');
    fireEvent.click(screen.getByRole('button', { name: /rever tutorial/i }));
    expect(localStorage.getItem('tour-boas-vindas')).toBeNull();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/$/);
  });
});
