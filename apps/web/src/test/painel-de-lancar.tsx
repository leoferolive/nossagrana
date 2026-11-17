import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { TransacaoModal } from '@/components/transacao-modal';
import { esquecerBuscasDeCategorias } from '@/hooks/use-categorias-mais-usadas';
import { transacaoService } from '@/services/core-financeiro.service';
import { useAvisoStore } from '@/stores/aviso.store';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';

/**
 * Apoio dos testes do painel de lançar (`transacao-modal*.test.tsx`): fixtures, `abrir` e os
 * seletores de chip. O arquivo de teste registra o `vi.mock` dos serviços (ver
 * `servicos-financeiros-falsos.ts`) e chama `configurarPainelDeTeste()`.
 */
export const configurarPainelDeTeste = () => {
  beforeEach(() => {
    esquecerBuscasDeCategorias();
    useAvisoStore.getState().fechar();
    vi.mocked(transacaoService.listar).mockResolvedValue({ transacoes: [] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
    useMetodoPagamentoStore.setState({ metodos: [], carregando: false, erro: null });
  });
};

export const categoria = (id: string, nome: string, tipo: 'despesa' | 'receita' = 'despesa') => ({
  id,
  nome,
  tipo,
  ativo: true,
  familiaId: 'f1',
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
});

export const CATEGORIAS = [categoria('c1', 'Mercado'), categoria('c2', 'Salario', 'receita')];

export const OITO_DESPESAS = [
  'Mercado',
  'Lazer',
  'Saúde',
  'Transporte',
  'Moradia',
  'Educação',
  'Viagem',
  'Pets',
].map((nome, i) => categoria(`d${i + 1}`, nome));

export const metodo = (id: string, nome: string, tipo: 'credito' | 'pix' | 'dinheiro') => ({
  id,
  nome,
  tipo,
  dataFechamento: tipo === 'credito' ? 15 : null,
  dataVencimento: tipo === 'credito' ? 22 : null,
  usuarioDonoId: 'u1',
  ativo: true,
  familiaId: 'f1',
  criadoEm: '2026-01-01',
});

export const METODOS = [metodo('m1', 'Nubank', 'credito'), metodo('m2', 'Pix', 'pix')];

export const poremCategorias = (lista = CATEGORIAS) =>
  useCategoriaStore.setState({ categorias: lista, carregando: false, erro: null });
export const poremMetodos = (lista = METODOS) =>
  useMetodoPagamentoStore.setState({ metodos: lista, carregando: false, erro: null });

export const abrir = (props: Partial<Parameters<typeof TransacaoModal>[0]> = {}) => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <TransacaoModal open familiaId="f1" onClose={onClose} onSubmit={onSubmit} {...props} />,
  );
  return { onClose, onSubmit, ...utils };
};

export const digitarValor = (v: string) =>
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: v } });
export const chip = (nome: string | RegExp) => screen.getByRole('button', { name: nome });
export const grupo = (nome: string) => screen.getByRole('group', { name: nome });
export const maisOpcoes = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Descrição, parcelas e repetição' }));
export const nomesDosChips = (nomeDoGrupo: string) =>
  within(grupo(nomeDoGrupo))
    .getAllByRole('button')
    .map((b) => b.textContent);

export const EDICAO = {
  id: 't1',
  tipo: 'despesa' as const,
  valor: '80',
  categoriaId: 'c1',
  descricao: null,
  data: '2026-03-05',
  metodoPagamentoId: null,
};
