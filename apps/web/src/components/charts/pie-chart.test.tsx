import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PieChart } from './pie-chart';

afterEach(() => {
  cleanup();
});

// Com o tamanho padrão (120): raio externo 50,4 e interno 31,2.
const RAIO_DO_ANEL = 40.8;
const LARGURA_DO_ANEL = 19.2;

function expectAnelCompleto(container: HTMLElement) {
  const anel = container.querySelector('circle');
  expect(anel).not.toBeNull();
  expect(Number(anel?.getAttribute('r'))).toBeCloseTo(RAIO_DO_ANEL, 5);
  expect(Number(anel?.getAttribute('stroke-width'))).toBeCloseTo(LARGURA_DO_ANEL, 5);
  expect(anel).toHaveAttribute('fill', 'none');
  expect(container.querySelectorAll('path')).toHaveLength(0);
}

describe('PieChart', () => {
  it('a legenda quebra linha em vez de estourar o cartão com valores grandes', () => {
    render(<PieChart data={[{ label: 'Moradia', value: 2345808.89 }]} />);

    const item = screen.getByText('Moradia').closest('li');
    expect(item).toHaveClass('flex-wrap');
    expect(item?.parentElement).toHaveClass('min-w-0');
  });

  // Regressão: com 100% em uma fatia o arco começava e terminava no mesmo
  // ponto e o SVG não desenhava nada.
  it('desenha um anel completo quando há uma única categoria', () => {
    const { container } = render(<PieChart data={[{ label: 'Moradia', value: 500 }]} />);

    expectAnelCompleto(container);
    expect(screen.getByText('Moradia')).toBeInTheDocument();
    expect(screen.getByText('(100%)')).toBeInTheDocument();
  });

  it('ignora categorias zeradas: desenha o anel e não as lista', () => {
    const { container } = render(
      <PieChart
        data={[
          { label: 'Moradia', value: 500 },
          { label: 'Lazer', value: 0 },
        ]}
      />,
    );

    expectAnelCompleto(container);
    expect(screen.queryByText('Lazer')).not.toBeInTheDocument();
  });

  it('desenha uma fatia por categoria quando há duas ou mais', () => {
    const { container } = render(
      <PieChart
        data={[
          { label: 'Moradia', value: 300 },
          { label: 'Lazer', value: 100 },
        ]}
      />,
    );

    expect(container.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelector('circle')).toBeNull();
    expect(screen.getByText('(75%)')).toBeInTheDocument();
    expect(screen.getByText('(25%)')).toBeInTheDocument();
  });

  it('não renderiza nada sem dados ou com tudo zerado', () => {
    const vazio = render(<PieChart data={[]} />);
    expect(vazio.container).toBeEmptyDOMElement();

    const zerado = render(<PieChart data={[{ label: 'Moradia', value: 0 }]} />);
    expect(zerado.container).toBeEmptyDOMElement();
  });
});
