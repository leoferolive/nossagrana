import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
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
  onGoToCofrinhos: vi.fn(),
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

  it('exibe atalho para Cartões / Pagamentos', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cartões \/ pagamentos/i })).toBeInTheDocument();
  });

  it('exibe atalho para Orçamento Mensal', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /orçamento mensal/i })).toBeInTheDocument();
  });

  it('exibe atalho para Família', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /família/i })).toBeInTheDocument();
  });

  it('exibe atalho para Histórico de Meses', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /histórico de meses/i })).toBeInTheDocument();
  });

  it('exibe atalho para Ajuda', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /ajuda/i })).toBeInTheDocument();
  });

  it('chama onGoToCategorias ao clicar em Categorias', () => {
    const onGoToCategorias = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToCategorias={onGoToCategorias} />);
    fireEvent.click(screen.getByRole('button', { name: /categorias/i }));
    expect(onGoToCategorias).toHaveBeenCalled();
  });

  it('chama onGoToMetodosPagamento ao clicar em Cartões / Pagamentos', () => {
    const onGoToMetodosPagamento = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToMetodosPagamento={onGoToMetodosPagamento} />);
    fireEvent.click(screen.getByRole('button', { name: /cartões \/ pagamentos/i }));
    expect(onGoToMetodosPagamento).toHaveBeenCalled();
  });

  it('chama onGoToOrcamento ao clicar em Orçamento Mensal', () => {
    const onGoToOrcamento = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToOrcamento={onGoToOrcamento} />);
    fireEvent.click(screen.getByRole('button', { name: /orçamento mensal/i }));
    expect(onGoToOrcamento).toHaveBeenCalled();
  });

  it('exibe atalho para Cofrinhos', () => {
    render(<ConfiguracoesPage {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cofrinhos/i })).toBeInTheDocument();
  });

  it('chama onGoToCofrinhos ao clicar em Cofrinhos', () => {
    const onGoToCofrinhos = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToCofrinhos={onGoToCofrinhos} />);
    fireEvent.click(screen.getByRole('button', { name: /cofrinhos/i }));
    expect(onGoToCofrinhos).toHaveBeenCalled();
  });

  it('chama onGoToFamilia ao clicar em Família', () => {
    const onGoToFamilia = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToFamilia={onGoToFamilia} />);
    fireEvent.click(screen.getByRole('button', { name: /família/i }));
    expect(onGoToFamilia).toHaveBeenCalled();
  });

  it('chama onGoToHistorico ao clicar em Histórico de Meses', () => {
    const onGoToHistorico = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToHistorico={onGoToHistorico} />);
    fireEvent.click(screen.getByRole('button', { name: /histórico de meses/i }));
    expect(onGoToHistorico).toHaveBeenCalled();
  });

  it('chama onGoToAjuda ao clicar em Ajuda', () => {
    const onGoToAjuda = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onGoToAjuda={onGoToAjuda} />);
    fireEvent.click(screen.getByRole('button', { name: /ajuda/i }));
    expect(onGoToAjuda).toHaveBeenCalled();
  });

  it('renderiza botão "Sair da conta"', () => {
    render(<ConfiguracoesPage {...defaultProps} onLogout={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sair da conta/i })).toBeInTheDocument();
  });

  it('chama onLogout ao clicar em "Sair da conta"', () => {
    const onLogout = vi.fn();
    render(<ConfiguracoesPage {...defaultProps} onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /sair da conta/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
