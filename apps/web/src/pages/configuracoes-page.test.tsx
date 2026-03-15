import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => (
    <div data-testid={`tour-${tourKey}`} />
  ),
}));

import { ConfiguracoesPage } from './configuracoes-page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultProps = {
  onBack: vi.fn(),
  onGoToCategorias: vi.fn(),
  onGoToMetodosPagamento: vi.fn(),
  onGoToOrcamento: vi.fn(),
  onGoToFamilia: vi.fn(),
  onGoToHistorico: vi.fn(),
  onGoToAjuda: vi.fn(),
};

describe('ConfiguracoesPage', () => {
  it('renderiza o título Configurações', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /configurações/i })).toBeInTheDocument();
  });

  it('exibe atalho para Categorias', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /categorias/i })).toBeInTheDocument();
  });

  it('exibe atalho para Cartões e Pagamentos', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cartões/i })).toBeInTheDocument();
  });

  it('exibe atalho para Orçamento', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /orçamento/i })).toBeInTheDocument();
  });

  it('exibe atalho para Família', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /família/i })).toBeInTheDocument();
  });

  it('exibe atalho para Histórico', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /histórico/i })).toBeInTheDocument();
  });

  it('exibe atalho para Ajuda', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /ajuda/i })).toBeInTheDocument();
  });

  it('chama onBack ao clicar em Voltar', () => {
    const onBack = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('chama onGoToCategorias ao clicar em Categorias', () => {
    const onGoToCategorias = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToCategorias={onGoToCategorias} />);
    fireEvent.click(screen.getByRole('button', { name: /categorias/i }));
    expect(onGoToCategorias).toHaveBeenCalled();
  });

  it('chama onGoToMetodosPagamento ao clicar em Cartões', () => {
    const onGoToMetodosPagamento = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToMetodosPagamento={onGoToMetodosPagamento} />);
    fireEvent.click(screen.getByRole('button', { name: /cartões/i }));
    expect(onGoToMetodosPagamento).toHaveBeenCalled();
  });

  it('chama onGoToOrcamento ao clicar em Orçamento', () => {
    const onGoToOrcamento = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToOrcamento={onGoToOrcamento} />);
    fireEvent.click(screen.getByRole('button', { name: /orçamento/i }));
    expect(onGoToOrcamento).toHaveBeenCalled();
  });

  it('chama onGoToFamilia ao clicar em Família', () => {
    const onGoToFamilia = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToFamilia={onGoToFamilia} />);
    fireEvent.click(screen.getByRole('button', { name: /família/i }));
    expect(onGoToFamilia).toHaveBeenCalled();
  });

  it('chama onGoToHistorico ao clicar em Histórico', () => {
    const onGoToHistorico = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToHistorico={onGoToHistorico} />);
    fireEvent.click(screen.getByRole('button', { name: /histórico/i }));
    expect(onGoToHistorico).toHaveBeenCalled();
  });

  it('chama onGoToAjuda ao clicar em Ajuda', () => {
    const onGoToAjuda = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToAjuda={onGoToAjuda} />);
    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));
    expect(onGoToAjuda).toHaveBeenCalled();
  });
});
