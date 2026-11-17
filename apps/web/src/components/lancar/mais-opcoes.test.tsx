import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CAMPOS_VAZIOS } from '@/hooks/use-formulario-lancamento';

import { MaisOpcoes } from './mais-opcoes';

afterEach(cleanup);

const montar = (props: Partial<Parameters<typeof MaisOpcoes>[0]> = {}) => {
  const mudar = vi.fn();
  const onAlternar = vi.fn();
  render(
    <MaisOpcoes
      aberto
      onAlternar={onAlternar}
      campos={CAMPOS_VAZIOS}
      mudar={mudar}
      editando={false}
      ehCredito={false}
      {...props}
    />,
  );
  return { mudar, onAlternar };
};

describe('MaisOpcoes', () => {
  it('fechado mostra só a linha, com aria-expanded falso', () => {
    montar({ aberto: false });
    expect(screen.getByRole('button', { name: 'Descrição, parcelas e repetição' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument();
  });

  it('a linha pede para alternar', () => {
    const { onAlternar } = montar({ aberto: false });
    fireEvent.click(screen.getByRole('button', { name: 'Descrição, parcelas e repetição' }));
    expect(onAlternar).toHaveBeenCalledOnce();
  });

  it('aberto mostra a descrição e avisa o que for digitado', () => {
    const { mudar } = montar();
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Feira' } });
    expect(mudar).toHaveBeenCalledWith({ descricao: 'Feira' });
  });

  it('parcelas só aparecem com cartão de crédito', () => {
    montar({ ehCredito: false });
    expect(screen.queryByRole('button', { name: 'Parcelado' })).not.toBeInTheDocument();
  });

  it('com crédito, parcelar mostra o número de parcelas e o valor de cada uma', () => {
    const { mudar } = montar({
      ehCredito: true,
      campos: { ...CAMPOS_VAZIOS, valor: '100', parcelado: true, numeroParcelas: 4 },
    });
    expect(screen.getByLabelText('Parcelas')).toHaveValue(4);
    expect(screen.getByText('= 25.00 por parcela')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Parcelado' }));
    expect(mudar).toHaveBeenCalledWith({ parcelado: false, recorrente: false });
  });

  it('repetir mostra frequência e data fim', () => {
    const { mudar } = montar({ campos: { ...CAMPOS_VAZIOS, recorrente: true } });
    expect(screen.getByRole('combobox', { name: 'Frequência' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Data fim recorrência'), {
      target: { value: '2027-01-10' },
    });
    expect(mudar).toHaveBeenCalledWith({ dataFimRecorrencia: '2027-01-10' });
  });

  it('na edição não oferece parcelas nem repetição', () => {
    montar({ editando: true, ehCredito: true });
    expect(screen.queryByRole('button', { name: 'Parcelado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recorrente' })).not.toBeInTheDocument();
  });

  it('na edição com exclusão disponível mostra "Excluir lançamento"', () => {
    const onExcluir = vi.fn();
    montar({ editando: true, onExcluir });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }));
    expect(onExcluir).toHaveBeenCalledOnce();
  });

  it('ao criar não mostra "Excluir lançamento"', () => {
    montar({ onExcluir: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Excluir lançamento' })).not.toBeInTheDocument();
  });
});
