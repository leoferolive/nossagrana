import { beforeEach, describe, expect, it } from 'vitest';

import { ClientePostgresFake } from '../../db/tests/cliente-postgres-fake.js';
import { DrizzleCofrinhoRepository } from './cofrinho.repository.js';

/** Mesma ordem das colunas selecionadas pelo repositório (`colunasCofrinho`). */
const linhaCofrinho = {
  id: 'c1',
  familiaId: 'fA',
  nome: 'Viagem',
  emoji: null,
  descricao: null,
  metaValor: null,
  saldoAtual: '10.00',
  status: 'ativo',
  criadoPor: 'u1',
  criadoEm: new Date('2026-09-01T00:00:00Z'),
  encerradoEm: null,
};

const alvo = { id: 'c1', familiaId: 'fA' };

describe('DrizzleCofrinhoRepository (SQL gerado)', () => {
  let cliente: ClientePostgresFake;
  let repo: DrizzleCofrinhoRepository;

  beforeEach(() => {
    cliente = new ClientePostgresFake();
    repo = new DrizzleCofrinhoRepository(cliente.executor());
  });

  const ultima = () => cliente.consultas.at(-1)!;

  it('incrementarSaldo: limita a espera por lock e soma no banco, só em cofrinho ativo da família', async () => {
    cliente.responderCom({ ...linhaCofrinho, saldoAtual: '15.50' });

    const atualizado = await repo.incrementarSaldo({ ...alvo, valor: '5.50' });

    expect(cliente.consultas[0]?.sql).toBe('SET LOCAL lock_timeout = 5000');
    expect(ultima().sql).toMatch(
      /^update "cofrinhos" set "saldo_atual" = "cofrinhos"\."saldo_atual" \+ \$1::numeric where \(\("cofrinhos"\."id" = \$2 and "cofrinhos"\."familia_id" = \$3\) and "cofrinhos"\."status" = \$4\) returning/,
    );
    expect(ultima().params).toEqual(['5.50', 'c1', 'fA', 'ativo']);
    expect(atualizado?.saldoAtual).toBe('15.50');
  });

  it('decrementarSaldo: condição saldo >= valor no próprio UPDATE; zero linhas vira null', async () => {
    const atualizado = await repo.decrementarSaldo({ ...alvo, valor: '99.99' });

    expect(ultima().sql).toMatch(
      /"saldo_atual" - \$1::numeric where \(\("cofrinhos"\."id" = \$2 and "cofrinhos"\."familia_id" = \$3\) and "cofrinhos"\."status" = \$4 and "cofrinhos"\."saldo_atual" >= \$5::numeric\)/,
    );
    expect(ultima().params).toEqual(['99.99', 'c1', 'fA', 'ativo', '99.99']);
    expect(atualizado).toBeNull();
  });

  it('bloquearParaAtualizacao: SELECT ... FOR UPDATE filtrando id e família', async () => {
    cliente.responderCom(linhaCofrinho);

    const bloqueado = await repo.bloquearParaAtualizacao(alvo);

    expect(cliente.consultas[0]?.sql).toBe('SET LOCAL lock_timeout = 5000');
    expect(ultima().sql).toMatch(
      /where \("cofrinhos"\."id" = \$1 and "cofrinhos"\."familia_id" = \$2\) for update$/,
    );
    expect(bloqueado).toMatchObject({ id: 'c1', status: 'ativo' });
  });

  it('espera por lock configurável; valor inválido é recusado citando o recebido', async () => {
    await new DrizzleCofrinhoRepository(cliente.executor(), 300).incrementarSaldo({
      ...alvo,
      valor: '1',
    });

    expect(cliente.consultas[0]?.sql).toBe('SET LOCAL lock_timeout = 300');
    expect(() => new DrizzleCofrinhoRepository(cliente.executor(), 0)).toThrow(/recebido 0/);
    expect(() => new DrizzleCofrinhoRepository(cliente.executor(), 1.5)).toThrow(/inteiro > 0/);
  });

  it('findById e list filtram pela família', async () => {
    cliente.responderCom(linhaCofrinho).responderCom(linhaCofrinho);

    expect(await repo.findById(alvo)).toMatchObject({ id: 'c1' });
    expect(cliente.consultas[0]?.params).toEqual(['c1', 'fA']);
    expect(await repo.list({ familiaId: 'fA', status: 'ativo' })).toHaveLength(1);
    expect(ultima().sql).toMatch(/"cofrinhos"\."familia_id" = \$1 and "cofrinhos"\."status" = \$2/);
    expect(await repo.findById(alvo)).toBeNull();
  });

  it('create, update e encerrar devolvem a linha (ou null sem linha ativa da família)', async () => {
    cliente.responderCom(linhaCofrinho).responderCom({ ...linhaCofrinho, nome: 'Novo' });

    expect(await repo.create({ familiaId: 'fA', nome: 'Viagem', criadoPor: 'u1' })).toMatchObject({
      id: 'c1',
    });
    expect(await repo.update({ ...alvo, nome: 'Novo' })).toMatchObject({ nome: 'Novo' });
    expect(ultima().sql).toMatch(
      /^update "cofrinhos" set "nome" = \$1 where \(\(.*"familia_id" = \$3\) and "cofrinhos"\."status" = \$4\)/,
    );
    expect(await repo.encerrar(alvo)).toBeNull();
    expect(ultima().params).toContain('encerrado');
  });

  it('update sem campos (PATCH vazio) não gera UPDATE: devolve o cofrinho ativo ou null', async () => {
    cliente.responderCom(linhaCofrinho).responderCom({ ...linhaCofrinho, status: 'encerrado' });

    expect(await repo.update({ ...alvo, nome: undefined })).toMatchObject({ id: 'c1' });
    expect(await repo.update(alvo)).toBeNull();
    expect(cliente.consultas.every((c) => c.sql.startsWith('select'))).toBe(true);
  });

  it('findAporteRecorrenteAtivo: série recorrente da família; sem frequência é null', async () => {
    const serie = {
      transacaoPaiId: 't1',
      valor: '20.00',
      frequencia: 'mensal',
      dataFimRecorrencia: null,
    };
    cliente.responderCom(serie).responderCom({ ...serie, frequencia: null });
    const busca = { cofrinhoId: 'c1', familiaId: 'fA' };

    expect(await repo.findAporteRecorrenteAtivo(busca)).toEqual(serie);
    expect(ultima().params).toEqual(['c1', 'fA', true]);
    expect(await repo.findAporteRecorrenteAtivo(busca)).toBeNull();
  });
});
