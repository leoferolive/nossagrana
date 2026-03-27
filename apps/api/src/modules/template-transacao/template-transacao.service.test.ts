import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import { TemplateTransacaoService, TemplateNotFoundError, TemplateTransacaoDuplicateError } from './template-transacao.service.js';
import type { TemplateTransacaoRepository } from './template-transacao.types.js';

describe('TemplateTransacaoService', () => {
  let repo: TemplateTransacaoRepository;
  let service: TemplateTransacaoService;
  const mockTransacaoCreator = { criar: vi.fn().mockResolvedValue({ id: 'tx-1' }) };
  const mockCofrinhoService = {
    aportar: vi.fn().mockResolvedValue({ cofrinho: { id: 'cof-1' }, movimentacao: { id: 'mov-1' } }),
  };

  beforeEach(() => {
    repo = new InMemoryTemplateTransacaoRepository();
    service = new TemplateTransacaoService(repo, mockTransacaoCreator, mockCofrinhoService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('cria template com sucesso', async () => {
      const t = await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      expect(t.nome).toBe('Luz');
      expect(t.ativo).toBe(true);
    });

    it('rejeita duplicata (mesmo nome + tipo + família)', async () => {
      await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      await expect(
        service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c2', criadoPor: 'u1' }),
      ).rejects.toThrow(TemplateTransacaoDuplicateError);
    });
  });

  describe('update', () => {
    it('atualiza template existente', async () => {
      const t = await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      const updated = await service.update({ id: t.id, familiaId: 'f1', nome: 'Energia Elétrica' });
      expect(updated.nome).toBe('Energia Elétrica');
    });

    it('lança erro se template não encontrado', async () => {
      await expect(service.update({ id: 'inexistente', familiaId: 'f1', nome: 'X' })).rejects.toThrow(TemplateNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('desativa template', async () => {
      const t = await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      const result = await service.deactivate({ id: t.id, familiaId: 'f1' });
      expect(result.ativo).toBe(false);
    });
  });

  describe('aplicar', () => {
    it('cria transações normais para templates sem cofrinho', async () => {
      const t = await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      const result = await service.aplicar({
        familiaId: 'f1', usuarioId: 'u1', mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '285.71' }],
      });
      expect(result.transacoesCriadas).toBe(1);
      expect(result.aportesCriados).toBe(0);
      expect(mockTransacaoCreator.criar).toHaveBeenCalledWith(expect.objectContaining({
        familiaId: 'f1', tipo: 'despesa', valor: '285.71', categoriaId: 'c1',
        descricao: 'Luz', data: '2026-03-01', mesReferencia: '2026-03', usuarioRegistrouId: 'u1',
      }));
    });

    it('chama cofrinhoService.aportar para templates com cofrinhoId', async () => {
      const t = await service.create({ familiaId: 'f1', nome: 'Fundo Emergência', tipo: 'despesa', cofrinhoId: 'cof-1', criadoPor: 'u1' });
      const result = await service.aplicar({
        familiaId: 'f1', usuarioId: 'u1', mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '200.00' }],
      });
      expect(result.aportesCriados).toBe(1);
      expect(result.transacoesCriadas).toBe(0);
      expect(mockCofrinhoService.aportar).toHaveBeenCalledWith(expect.objectContaining({
        cofrinhoId: 'cof-1', familiaId: 'f1', valor: '200.00', descricao: 'Fundo Emergência',
        registradoPor: 'u1', mesReferencia: '2026-03', data: '2026-03-01',
      }));
    });

    it('filtra itens com valor zero', async () => {
      const t1 = await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      const t2 = await service.create({ familiaId: 'f1', nome: 'Gás', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      const result = await service.aplicar({
        familiaId: 'f1', usuarioId: 'u1', mesReferencia: '2026-03',
        itens: [{ templateId: t1.id, valor: '285.71' }, { templateId: t2.id, valor: '0' }],
      });
      expect(result.total).toBe(1);
      expect(mockTransacaoCreator.criar).toHaveBeenCalledTimes(1);
    });

    it('lança erro se template não pertence à família', async () => {
      const t = await service.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
      await expect(
        service.aplicar({ familiaId: 'f2', usuarioId: 'u2', mesReferencia: '2026-03', itens: [{ templateId: t.id, valor: '100' }] }),
      ).rejects.toThrow(TemplateNotFoundError);
    });
  });
});
