import type { CategoriaListResponse, TransacaoListResponse } from '@nossagrana/types';
import { describe, expect, it } from 'vitest';

import { categoriasMaisUsadas } from './categorias-mais-usadas';

type Categoria = CategoriaListResponse['categorias'][number];
type Transacao = TransacaoListResponse['transacoes'][number];

const HOJE = '2026-11-17';

const cat = (id: string, nome: string, extra: Partial<Categoria> = {}): Categoria => ({
  id,
  nome,
  tipo: 'despesa',
  ativo: true,
  familiaId: 'f1',
  criadoPor: 'u1',
  criadoEm: '2026-01-01',
  ...extra,
});

const lanc = (categoriaId: string, data: string, tipo: Transacao['tipo'] = 'despesa') =>
  ({ categoriaId, data, tipo }) as Transacao;

const nomes = (lista: Categoria[]) => lista.map((c) => c.nome);

describe('categoriasMaisUsadas', () => {
  const categorias = [cat('a', 'Alimentação'), cat('b', 'Mercado'), cat('c', 'Lazer')];

  it('ordena pela contagem de lançamentos', () => {
    const transacoes = [
      lanc('c', '2026-11-10'),
      lanc('b', '2026-11-11'),
      lanc('b', '2026-11-12'),
      lanc('c', '2026-11-13'),
      lanc('c', '2026-11-14'),
    ];
    const r = categoriasMaisUsadas({ transacoes, categorias, tipo: 'despesa', hoje: HOJE });
    expect(nomes(r)).toEqual(['Lazer', 'Mercado', 'Alimentação']);
  });

  it('desempata pelo nome', () => {
    const transacoes = [lanc('c', '2026-11-10'), lanc('a', '2026-11-11'), lanc('b', '2026-11-12')];
    const r = categoriasMaisUsadas({ transacoes, categorias, tipo: 'despesa', hoje: HOJE });
    expect(nomes(r)).toEqual(['Alimentação', 'Lazer', 'Mercado']);
  });

  it('conta só os últimos 60 dias, com hoje incluído', () => {
    const transacoes = [
      lanc('a', '2026-09-19'), // 59 dias atrás: conta
      lanc('b', '2026-09-17'), // 61 dias atrás: não conta
      lanc('b', '2026-09-16'),
    ];
    const r = categoriasMaisUsadas({
      transacoes,
      categorias,
      tipo: 'despesa',
      hoje: HOJE,
      limite: 1,
    });
    expect(nomes(r)).toEqual(['Alimentação']);
  });

  it('ignora lançamento no futuro', () => {
    const transacoes = [lanc('b', '2026-12-05'), lanc('a', HOJE)];
    const r = categoriasMaisUsadas({
      transacoes,
      categorias,
      tipo: 'despesa',
      hoje: HOJE,
      limite: 1,
    });
    expect(nomes(r)).toEqual(['Alimentação']);
  });

  it('não inclui categoria inativa nem de outro tipo', () => {
    const lista = [
      cat('a', 'Alimentação', { ativo: false }),
      cat('b', 'Mercado'),
      cat('r', 'Salário', { tipo: 'receita' }),
    ];
    const transacoes = [lanc('a', HOJE), lanc('r', HOJE, 'receita')];
    const r = categoriasMaisUsadas({ transacoes, categorias: lista, tipo: 'despesa', hoje: HOJE });
    expect(nomes(r)).toEqual(['Mercado']);
  });

  it('família sem histórico recebe as primeiras do tipo, na ordem da lista', () => {
    const lista = [
      cat('c', 'Lazer'),
      cat('a', 'Alimentação'),
      cat('r', 'Salário', { tipo: 'receita' }),
    ];
    const r = categoriasMaisUsadas({
      transacoes: [],
      categorias: lista,
      tipo: 'despesa',
      hoje: HOJE,
    });
    expect(nomes(r)).toEqual(['Lazer', 'Alimentação']);
  });

  it('completa com as primeiras da lista até o limite, sem repetir', () => {
    const lista = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((n) => cat(n.toLowerCase(), n));
    const transacoes = [lanc('h', HOJE), lanc('h', HOJE), lanc('g', HOJE)];
    const r = categoriasMaisUsadas({ transacoes, categorias: lista, tipo: 'despesa', hoje: HOJE });
    expect(nomes(r)).toEqual(['H', 'G', 'A', 'B', 'C', 'D']);
  });

  it('respeita o limite informado', () => {
    const r = categoriasMaisUsadas({
      transacoes: [],
      categorias,
      tipo: 'despesa',
      hoje: HOJE,
      limite: 2,
    });
    expect(r).toHaveLength(2);
  });

  it('lançamento de categoria que não existe mais na lista é ignorado', () => {
    const r = categoriasMaisUsadas({
      transacoes: [lanc('x', HOJE)],
      categorias,
      tipo: 'despesa',
      hoje: HOJE,
      limite: 1,
    });
    expect(nomes(r)).toEqual(['Alimentação']);
  });
});
