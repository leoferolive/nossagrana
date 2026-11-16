import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderPagina } from '../test/render-pagina';

import { CabecalhoDetalhe } from './cabecalho-detalhe';

afterEach(cleanup);

const local = () => screen.getByTestId('sonda-local');

describe('CabecalhoDetalhe', () => {
  it('mostra o título como heading de nível 1 em 20/800', () => {
    renderPagina(<CabecalhoDetalhe titulo="Categorias" origem="/mais" />);
    const titulo = screen.getByRole('heading', { level: 1, name: 'Categorias' });
    expect(titulo).toHaveClass('text-xl', 'font-extrabold');
  });

  it('o botão Voltar tem 44x44', () => {
    renderPagina(<CabecalhoDetalhe titulo="Categorias" origem="/mais" />);
    expect(screen.getByRole('button', { name: 'Voltar' })).toHaveClass('min-h-11', 'min-w-11');
  });

  it('voltar volta uma entrada quando há tela anterior do app', () => {
    renderPagina(<CabecalhoDetalhe titulo="Categorias" origem="/mais" />, [
      '/planejar',
      '/mais/categorias',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(local()).toHaveTextContent(/^\/planejar$/);
  });

  it('aberto por link direto, voltar vai à origem do mapa e não sai do app', () => {
    renderPagina(<CabecalhoDetalhe titulo="Categorias" origem="/mais" />, '/mais/categorias');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(local()).toHaveTextContent(/^\/mais$/);
  });

  it('mostra subtítulo e ação à direita quando passados', () => {
    renderPagina(
      <CabecalhoDetalhe
        titulo="Fatura"
        origem="/planejar"
        subtitulo="2026-03"
        acao={<button type="button">Gerenciar</button>}
      />,
    );
    expect(screen.getByText('2026-03')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerenciar' })).toBeInTheDocument();
  });
});
