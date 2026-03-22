import { describe, it, expect, beforeEach, vi } from 'vitest';

import { InMemoryCofrinhoRepository } from './cofrinho.repository.js';
import {
  CofrinhoService,
  CofrinhoNotFoundError,
  CofrinhoEncerradoError,
  SaldoInsuficienteError,
  AporteRecorrenteJaAtivoError,
  AporteRecorrenteNotFoundError,
} from './cofrinho.service.js';
import type { TransacaoCreator, TransacaoRecorrenteCreator } from './cofrinho.types.js';

function makeMockTransacaoCreator(): TransacaoCreator & {
  criar: ReturnType<typeof vi.fn>;
} {
  return {
    criar: vi.fn().mockImplementation(async () => ({
      id: 'tx-' + Math.random().toString(36).slice(2),
    })),
  };
}

const mockGetCategoriaCofrinho = async (_familiaId: string) => ({
  id: 'cat-cofrinho-id',
});

function makeMockTransacaoRecorrenteCreator(): TransacaoRecorrenteCreator & {
  criarRecorrente: ReturnType<typeof vi.fn>;
  cancelarRecorrencia: ReturnType<typeof vi.fn>;
} {
  return {
    criarRecorrente: vi.fn().mockImplementation(async () => ({
      id: 'tx-recorrente-' + Math.random().toString(36).slice(2),
    })),
    cancelarRecorrencia: vi.fn().mockImplementation(async () => {}),
  };
}

describe('CofrinhoService', () => {
  let service: CofrinhoService;
  let serviceComRecorrente: CofrinhoService;
  let repo: InMemoryCofrinhoRepository;
  let mockTransacaoCreator: ReturnType<typeof makeMockTransacaoCreator>;
  let mockTransacaoRecorrenteCreator: ReturnType<typeof makeMockTransacaoRecorrenteCreator>;

  beforeEach(() => {
    repo = new InMemoryCofrinhoRepository();
    mockTransacaoCreator = makeMockTransacaoCreator();
    mockTransacaoRecorrenteCreator = makeMockTransacaoRecorrenteCreator();
    service = new CofrinhoService(
      repo,
      mockTransacaoCreator,
      mockGetCategoriaCofrinho,
    );
    serviceComRecorrente = new CofrinhoService(
      repo,
      mockTransacaoCreator,
      mockGetCategoriaCofrinho,
      mockTransacaoRecorrenteCreator,
    );
  });

  describe('criar', () => {
    it('deve criar cofrinho com nome, emoji e meta', async () => {
      const result = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        emoji: '✈️',
        metaValor: '5000.00',
        criadoPor: 'u1',
      });

      expect(result.nome).toBe('Viagem');
      expect(result.emoji).toBe('✈️');
      expect(result.metaValor).toBe('5000.00');
      expect(result.saldoAtual).toBe('0');
      expect(result.status).toBe('ativo');
      expect(result.id).toBeDefined();
      expect(result.familiaId).toBe('f1');
      expect(result.criadoPor).toBe('u1');
    });

    it('deve criar cofrinho sem emoji e sem meta', async () => {
      const result = await service.criar({
        familiaId: 'f1',
        nome: 'Emergência',
        criadoPor: 'u1',
      });

      expect(result.nome).toBe('Emergência');
      expect(result.emoji).toBeNull();
      expect(result.metaValor).toBeNull();
      expect(result.saldoAtual).toBe('0');
      expect(result.status).toBe('ativo');
    });
  });

  describe('editar', () => {
    it('deve atualizar nome e meta', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        emoji: '✈️',
        metaValor: '5000.00',
        criadoPor: 'u1',
      });

      const updated = await service.editar({
        id: cofrinho.id,
        familiaId: 'f1',
        nome: 'Viagem Europa',
        metaValor: '10000.00',
      });

      expect(updated.nome).toBe('Viagem Europa');
      expect(updated.metaValor).toBe('10000.00');
      expect(updated.emoji).toBe('✈️');
    });

    it('deve rejeitar se não encontrado', async () => {
      await expect(
        service.editar({
          id: 'inexistente',
          familiaId: 'f1',
          nome: 'Teste',
        }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se encerrado', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await repo.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(
        service.editar({
          id: cofrinho.id,
          familiaId: 'f1',
          nome: 'Outro nome',
        }),
      ).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('aportar (simples)', () => {
    it('deve criar transação de despesa + movimentação + incrementar saldo', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        emoji: '✈️',
        metaValor: '5000.00',
        criadoPor: 'u1',
      });

      const result = await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '500.00',
        descricao: 'Primeiro aporte',
        registradoPor: 'u1',
      });

      // Verify saldo was updated
      expect(result.cofrinho.saldoAtual).toBe('500.00');

      // Verify movimentacao was created
      expect(result.movimentacao.tipo).toBe('aporte');
      expect(result.movimentacao.valor).toBe('500.00');
      expect(result.movimentacao.descricao).toBe('Primeiro aporte');
      expect(result.movimentacao.transacaoId).toBeDefined();

      // Verify transacaoCreator.criar was called with correct params
      expect(mockTransacaoCreator.criar).toHaveBeenCalledOnce();
      const criarCall = mockTransacaoCreator.criar.mock.calls[0][0];
      expect(criarCall.tipo).toBe('despesa');
      expect(criarCall.valor).toBe('500.00');
      expect(criarCall.categoriaId).toBe('cat-cofrinho-id');
      expect(criarCall.familiaId).toBe('f1');
      expect(criarCall.cofrinhoId).toBe(cofrinho.id);
    });

    it('deve acumular saldo em múltiplos aportes', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });

      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '100.50',
        registradoPor: 'u1',
      });

      const result = await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '200.75',
        registradoPor: 'u1',
      });

      expect(result.cofrinho.saldoAtual).toBe('301.25');
    });

    it('deve rejeitar se cofrinho não encontrado', async () => {
      await expect(
        service.aportar({
          cofrinhoId: 'inexistente',
          familiaId: 'f1',
          valor: '100.00',
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se cofrinho encerrado', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await repo.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(
        service.aportar({
          cofrinhoId: cofrinho.id,
          familiaId: 'f1',
          valor: '100.00',
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('retirar', () => {
    it('com voltarAoSaldo=true: cria transação de receita + movimentação + decrementa saldo', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '1000.00',
        registradoPor: 'u1',
      });
      mockTransacaoCreator.criar.mockClear();

      const result = await service.retirar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '300.00',
        descricao: 'Comprei passagem',
        voltarAoSaldo: true,
        registradoPor: 'u1',
      });

      expect(result.cofrinho.saldoAtual).toBe('700.00');
      expect(result.movimentacao.tipo).toBe('retirada');
      expect(result.movimentacao.valor).toBe('300.00');
      expect(result.movimentacao.transacaoId).toBeDefined();

      // Verify transação de receita was created
      expect(mockTransacaoCreator.criar).toHaveBeenCalledOnce();
      const criarCall = mockTransacaoCreator.criar.mock.calls[0][0];
      expect(criarCall.tipo).toBe('receita');
      expect(criarCall.valor).toBe('300.00');
      expect(criarCall.categoriaId).toBe('cat-cofrinho-id');
    });

    it('com voltarAoSaldo=false: apenas movimentação, sem transação', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '1000.00',
        registradoPor: 'u1',
      });
      mockTransacaoCreator.criar.mockClear();

      const result = await service.retirar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '300.00',
        voltarAoSaldo: false,
        registradoPor: 'u1',
      });

      expect(result.cofrinho.saldoAtual).toBe('700.00');
      expect(result.movimentacao.tipo).toBe('retirada');
      expect(result.movimentacao.valor).toBe('300.00');
      expect(result.movimentacao.transacaoId).toBeNull();

      // Verify no transação was created
      expect(mockTransacaoCreator.criar).not.toHaveBeenCalled();
    });

    it('deve rejeitar se saldo insuficiente', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '100.00',
        registradoPor: 'u1',
      });

      await expect(
        service.retirar({
          cofrinhoId: cofrinho.id,
          familiaId: 'f1',
          valor: '200.00',
          voltarAoSaldo: true,
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(SaldoInsuficienteError);
    });

    it('deve rejeitar se cofrinho não encontrado', async () => {
      await expect(
        service.retirar({
          cofrinhoId: 'inexistente',
          familiaId: 'f1',
          valor: '100.00',
          voltarAoSaldo: true,
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se cofrinho encerrado', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '500.00',
        registradoPor: 'u1',
      });
      await repo.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(
        service.retirar({
          cofrinhoId: cofrinho.id,
          familiaId: 'f1',
          valor: '100.00',
          voltarAoSaldo: true,
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('encerrar', () => {
    it('com saldo 0: muda status para encerrado', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });

      const result = await service.encerrar({
        id: cofrinho.id,
        familiaId: 'f1',
        voltarAoSaldo: false,
        registradoPor: 'u1',
      });

      expect(result.status).toBe('encerrado');
      expect(result.encerradoEm).not.toBeNull();
    });

    it('com saldo > 0 e voltarAoSaldo=true: cria retirada total + encerra', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '500.00',
        registradoPor: 'u1',
      });
      mockTransacaoCreator.criar.mockClear();

      const result = await service.encerrar({
        id: cofrinho.id,
        familiaId: 'f1',
        voltarAoSaldo: true,
        registradoPor: 'u1',
      });

      expect(result.status).toBe('encerrado');
      expect(parseFloat(result.saldoAtual)).toBe(0);

      // Verify retirada transação was created
      expect(mockTransacaoCreator.criar).toHaveBeenCalledOnce();
      const criarCall = mockTransacaoCreator.criar.mock.calls[0][0];
      expect(criarCall.tipo).toBe('receita');
      expect(criarCall.valor).toBe('500.00');
    });

    it('com saldo > 0 e voltarAoSaldo=false: zera saldo + encerra', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '500.00',
        registradoPor: 'u1',
      });
      mockTransacaoCreator.criar.mockClear();

      const result = await service.encerrar({
        id: cofrinho.id,
        familiaId: 'f1',
        voltarAoSaldo: false,
        registradoPor: 'u1',
      });

      expect(result.status).toBe('encerrado');
      expect(parseFloat(result.saldoAtual)).toBe(0);

      // Verify NO transação was created
      expect(mockTransacaoCreator.criar).not.toHaveBeenCalled();
    });

    it('deve rejeitar se não encontrado', async () => {
      await expect(
        service.encerrar({
          id: 'inexistente',
          familiaId: 'f1',
          voltarAoSaldo: false,
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se já encerrado', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await repo.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(
        service.encerrar({
          id: cofrinho.id,
          familiaId: 'f1',
          voltarAoSaldo: false,
          registradoPor: 'u1',
        }),
      ).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('listar', () => {
    it('deve retornar cofrinhos ativos', async () => {
      await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.criar({
        familiaId: 'f1',
        nome: 'Emergência',
        criadoPor: 'u1',
      });

      const ativos = await service.listar({ familiaId: 'f1', status: 'ativo' });
      expect(ativos).toHaveLength(2);
    });

    it('deve filtrar por status', async () => {
      const c1 = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.criar({
        familiaId: 'f1',
        nome: 'Emergência',
        criadoPor: 'u1',
      });
      await service.encerrar({
        id: c1.id,
        familiaId: 'f1',
        voltarAoSaldo: false,
        registradoPor: 'u1',
      });

      const ativos = await service.listar({ familiaId: 'f1', status: 'ativo' });
      expect(ativos).toHaveLength(1);
      expect(ativos[0].nome).toBe('Emergência');

      const encerrados = await service.listar({
        familiaId: 'f1',
        status: 'encerrado',
      });
      expect(encerrados).toHaveLength(1);
      expect(encerrados[0].nome).toBe('Viagem');
    });

    it('deve isolar por familiaId', async () => {
      await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.criar({
        familiaId: 'f2',
        nome: 'Carro',
        criadoPor: 'u2',
      });

      const f1 = await service.listar({ familiaId: 'f1', status: 'ativo' });
      expect(f1).toHaveLength(1);
      expect(f1[0].nome).toBe('Viagem');

      const f2 = await service.listar({ familiaId: 'f2', status: 'ativo' });
      expect(f2).toHaveLength(1);
      expect(f2[0].nome).toBe('Carro');
    });
  });

  describe('detalhe', () => {
    it('deve retornar cofrinho com movimentações', async () => {
      const cofrinho = await service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '100.00',
        registradoPor: 'u1',
      });
      await service.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '200.00',
        registradoPor: 'u1',
      });

      const result = await service.detalhe({
        id: cofrinho.id,
        familiaId: 'f1',
      });

      expect(result.cofrinho.nome).toBe('Viagem');
      expect(result.cofrinho.saldoAtual).toBe('300.00');
      expect(result.movimentacoes).toHaveLength(2);
      expect(result.aporteRecorrenteAtivo).toBeNull();
    });

    it('deve rejeitar se não encontrado', async () => {
      await expect(
        service.detalhe({ id: 'inexistente', familiaId: 'f1' }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });
  });

  describe('aportar recorrente', () => {
    it('deve criar transação-pai recorrente + primeira movimentação', async () => {
      const cofrinho = await serviceComRecorrente.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        emoji: '✈️',
        metaValor: '5000.00',
        criadoPor: 'u1',
      });

      const result = await serviceComRecorrente.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '200.00',
        descricao: 'Aporte mensal',
        registradoPor: 'u1',
        recorrente: true,
        frequencia: 'mensal',
      });

      // Verify transacaoRecorrenteCreator.criarRecorrente was called
      expect(mockTransacaoRecorrenteCreator.criarRecorrente).toHaveBeenCalledOnce();
      const criarCall = mockTransacaoRecorrenteCreator.criarRecorrente.mock.calls[0][0];
      expect(criarCall.tipo).toBe('despesa');
      expect(criarCall.valor).toBe('200.00');
      expect(criarCall.categoriaId).toBe('cat-cofrinho-id');
      expect(criarCall.familiaId).toBe('f1');
      expect(criarCall.cofrinhoId).toBe(cofrinho.id);
      expect(criarCall.frequencia).toBe('mensal');

      // Verify transacaoCreator.criar was NOT called (recorrente uses its own creator)
      expect(mockTransacaoCreator.criar).not.toHaveBeenCalled();

      // Verify movimentacao was created
      expect(result.movimentacao.tipo).toBe('aporte');
      expect(result.movimentacao.valor).toBe('200.00');
      expect(result.movimentacao.descricao).toBe('Aporte mensal');
      expect(result.movimentacao.transacaoId).toBeDefined();

      // Verify saldo was updated
      expect(result.cofrinho.saldoAtual).toBe('200.00');
    });

    it('deve passar dataFimRecorrencia quando informada', async () => {
      const cofrinho = await serviceComRecorrente.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });

      await serviceComRecorrente.aportar({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
        valor: '100.00',
        registradoPor: 'u1',
        recorrente: true,
        frequencia: 'mensal',
        dataFimRecorrencia: '2027-12-31',
      });

      const criarCall = mockTransacaoRecorrenteCreator.criarRecorrente.mock.calls[0][0];
      expect(criarCall.dataFimRecorrencia).toBe('2027-12-31');
    });

    it('deve rejeitar se já existe aporte recorrente ativo', async () => {
      const cofrinho = await serviceComRecorrente.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });

      // Mock repo.findAporteRecorrenteAtivo to return non-null
      vi.spyOn(repo, 'findAporteRecorrenteAtivo').mockResolvedValueOnce({
        transacaoPaiId: 'tx-existing',
        valor: '100.00',
        frequencia: 'mensal',
        dataFimRecorrencia: null,
      });

      await expect(
        serviceComRecorrente.aportar({
          cofrinhoId: cofrinho.id,
          familiaId: 'f1',
          valor: '200.00',
          registradoPor: 'u1',
          recorrente: true,
          frequencia: 'mensal',
        }),
      ).rejects.toThrow(AporteRecorrenteJaAtivoError);
    });
  });

  describe('cancelarAporteRecorrente', () => {
    it('deve cancelar aporte recorrente ativo', async () => {
      const cofrinho = await serviceComRecorrente.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });

      // Mock repo.findAporteRecorrenteAtivo to return aporte data
      vi.spyOn(repo, 'findAporteRecorrenteAtivo').mockResolvedValueOnce({
        transacaoPaiId: 'tx-recorrente-123',
        valor: '200.00',
        frequencia: 'mensal',
        dataFimRecorrencia: null,
      });

      await serviceComRecorrente.cancelarAporteRecorrente({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
      });

      // Verify transacaoRecorrenteCreator.cancelarRecorrencia was called
      expect(mockTransacaoRecorrenteCreator.cancelarRecorrencia).toHaveBeenCalledOnce();
      expect(mockTransacaoRecorrenteCreator.cancelarRecorrencia).toHaveBeenCalledWith({
        transacaoPaiId: 'tx-recorrente-123',
        familiaId: 'f1',
      });
    });

    it('deve rejeitar se não há aporte recorrente ativo', async () => {
      const cofrinho = await serviceComRecorrente.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        criadoPor: 'u1',
      });

      // repo.findAporteRecorrenteAtivo returns null by default

      await expect(
        serviceComRecorrente.cancelarAporteRecorrente({
          cofrinhoId: cofrinho.id,
          familiaId: 'f1',
        }),
      ).rejects.toThrow(AporteRecorrenteNotFoundError);
    });

    it('deve rejeitar se cofrinho não encontrado', async () => {
      await expect(
        serviceComRecorrente.cancelarAporteRecorrente({
          cofrinhoId: 'inexistente',
          familiaId: 'f1',
        }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });
  });
});
