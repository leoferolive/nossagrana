import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type InitialEntry } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { usePainelLancar } from './use-painel-lancar';

const Sonda = () => {
  const painel = usePainelLancar();
  const local = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output data-testid="local">{`${local.pathname}${local.search}`}</output>
      <output data-testid="aberto">{String(painel.aberto)}</output>
      <output data-testid="transacao">{painel.transacaoId ?? 'nenhuma'}</output>
      <button onClick={painel.abrirNova}>nova</button>
      <button onClick={() => painel.abrirEdicao('tx-9')}>editar</button>
      <button onClick={painel.fechar}>fechar</button>
      <button
        onClick={() => {
          painel.fechar();
          painel.fechar();
        }}
      >
        fechar duas vezes
      </button>
      <button onClick={() => void navigate(-1)}>atras</button>
      <button onClick={() => void navigate(1)}>avancar</button>
    </div>
  );
};

const montar = (entradas: InitialEntry[]) =>
  render(
    <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
      <Sonda />
    </MemoryRouter>,
  );

const clicar = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));
const local = () => screen.getByTestId('local').textContent;

afterEach(cleanup);

describe('usePainelLancar', () => {
  it('começa fechado, sem transação', () => {
    montar(['/extrato']);

    expect(screen.getByTestId('aberto')).toHaveTextContent('false');
    expect(screen.getByTestId('transacao')).toHaveTextContent('nenhuma');
  });

  it('abrirNova acrescenta ?lancar=nova ao endereço atual', () => {
    montar(['/extrato']);

    clicar('nova');

    expect(local()).toBe('/extrato?lancar=nova');
    expect(screen.getByTestId('aberto')).toHaveTextContent('true');
    expect(screen.getByTestId('transacao')).toHaveTextContent('nenhuma');
  });

  it('abrirEdicao acrescenta ?lancar=<id> e expõe o id', () => {
    montar(['/extrato']);

    clicar('editar');

    expect(local()).toBe('/extrato?lancar=tx-9');
    expect(screen.getByTestId('transacao')).toHaveTextContent('tx-9');
  });

  it('mantém os outros parâmetros do endereço', () => {
    montar(['/planejar/fatura/m1?mes=2026-11']);

    clicar('nova');

    expect(local()).toBe('/planejar/fatura/m1?mes=2026-11&lancar=nova');
  });

  it('fechar depois de abrir volta uma entrada, e voltar de novo sai da tela', () => {
    montar(['/', '/extrato']);
    clicar('nova');

    clicar('fechar');

    expect(local()).toBe('/extrato');
    expect(screen.getByTestId('aberto')).toHaveTextContent('false');
    clicar('atras');
    expect(local()).toBe('/');
  });

  it('voltar do navegador com o painel aberto só fecha o painel', () => {
    montar(['/', '/extrato']);
    clicar('nova');

    clicar('atras');

    expect(local()).toBe('/extrato');
    expect(screen.getByTestId('aberto')).toHaveTextContent('false');
  });

  it('endereço que já chegou com o parâmetro: fechar só o remove, substituindo a entrada', () => {
    montar(['/', '/extrato?lancar=nova']);

    clicar('fechar');

    expect(local()).toBe('/extrato');
    clicar('atras');
    expect(local()).toBe('/');
  });

  it('abrir de novo com o painel aberto troca a entrada em vez de empilhar outra', () => {
    montar(['/', '/extrato']);
    clicar('nova');

    clicar('editar');

    expect(local()).toBe('/extrato?lancar=tx-9');
    clicar('atras');
    expect(local()).toBe('/extrato');
  });

  it('fechar com o painel já fechado não navega', () => {
    montar(['/', '/extrato']);

    clicar('fechar');

    expect(local()).toBe('/extrato');
    clicar('atras');
    expect(local()).toBe('/');
  });

  it('duas chamadas seguidas de fechar andam uma entrada só', () => {
    montar(['/', '/extrato']);
    clicar('nova');

    clicar('fechar duas vezes');

    expect(local()).toBe('/extrato');
    clicar('atras');
    expect(local()).toBe('/');
  });

  it('depois de fechado, avançar reabre o painel e fechar volta de novo', () => {
    montar(['/', '/extrato']);
    clicar('nova');
    clicar('fechar');

    clicar('avancar');
    expect(screen.getByTestId('aberto')).toHaveTextContent('true');
    clicar('fechar');

    expect(local()).toBe('/extrato');
  });
});
