import { describe, expect, it, vi } from 'vitest';

import { InMemoryReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import {
  ReferenciaInvalidaError,
  ReferenciaOwnershipValidator,
} from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import { TemplateTransacaoService } from './template-transacao.service.js';

const FAMILIA_A = 'familia-a';
const FAMILIA_B = 'familia-b';

function setup() {
  const referencias = new InMemoryReferenciaOwnershipRepository();
  referencias.addCategoria({ id: 'cat-a', familiaId: FAMILIA_A, tipo: 'despesa', ativo: true });
  referencias.addCategoria({ id: 'cat-a2', familiaId: FAMILIA_A, tipo: 'despesa', ativo: true });
  referencias.addCategoria({
    id: 'cat-a-inativa',
    familiaId: FAMILIA_A,
    tipo: 'despesa',
    ativo: false,
  });
  referencias.addCategoria({
    id: 'cat-a-receita',
    familiaId: FAMILIA_A,
    tipo: 'receita',
    ativo: true,
  });
  referencias.addCategoria({ id: 'cat-b', familiaId: FAMILIA_B, tipo: 'despesa', ativo: true });
  referencias.addMetodoPagamento({ id: 'mp-a', familiaId: FAMILIA_A, ativo: true });
  referencias.addMetodoPagamento({ id: 'mp-b', familiaId: FAMILIA_B, ativo: true });
  referencias.addCofrinho({ id: 'cf-a', familiaId: FAMILIA_A, ativo: true });
  referencias.addCofrinho({ id: 'cf-b', familiaId: FAMILIA_B, ativo: true });

  const repo = new InMemoryTemplateTransacaoRepository();
  const transacaoCreator = { criar: vi.fn().mockResolvedValue({ id: 'tx-1' }) };
  const cofrinhoService = { aportar: vi.fn().mockResolvedValue({}) };
  const service = new TemplateTransacaoService(
    repo,
    transacaoCreator,
    cofrinhoService,
    new ReferenciaOwnershipValidator(referencias),
  );
  return { repo, service, referencias, transacaoCreator, cofrinhoService };
}

const novo = (override: Record<string, unknown> = {}) => ({
  familiaId: FAMILIA_A,
  nome: 'Luz',
  tipo: 'despesa' as const,
  categoriaId: 'cat-a',
  metodoPagamentoId: 'mp-a',
  criadoPor: 'u1',
  ...override,
});

describe('TemplateTransacaoService — ownership de referências (#55)', () => {
  describe('create', () => {
    it('cria template com referências da própria família', async () => {
      const { service } = setup();

      const t = await service.create({ ...novo(), cofrinhoId: 'cf-a' });

      expect(t.categoriaId).toBe('cat-a');
    });

    it.each([
      ['categoria de outra família', { categoriaId: 'cat-b' }, 'categoria'],
      ['método de outra família', { metodoPagamentoId: 'mp-b' }, 'metodoPagamento'],
      ['cofrinho de outra família', { cofrinhoId: 'cf-b' }, 'cofrinho'],
      ['categoria inativa', { categoriaId: 'cat-a-inativa' }, 'categoria'],
      ['categoria de tipo incompatível', { categoriaId: 'cat-a-receita' }, 'categoria'],
    ])('rejeita %s sem criar template', async (_caso, override, entidade) => {
      const { service, repo } = setup();

      const erro = await service.create(novo(override)).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(ReferenciaInvalidaError);
      expect((erro as ReferenciaInvalidaError).entidade).toBe(entidade);
      expect(await repo.listByFamiliaId({ familiaId: FAMILIA_A })).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('rejeita trocar para cofrinho de outra família e mantém o template', async () => {
      const { service, repo } = setup();
      const t = await service.create(novo());

      await expect(
        service.update({ id: t.id, familiaId: FAMILIA_A, cofrinhoId: 'cf-b' }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);

      expect((await repo.findById({ id: t.id, familiaId: FAMILIA_A }))?.cofrinhoId).toBeNull();
    });

    it('rejeita trocar para categoria de outra família', async () => {
      const { service } = setup();
      const t = await service.create(novo());

      await expect(
        service.update({ id: t.id, familiaId: FAMILIA_A, categoriaId: 'cat-b' }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);
    });

    it('permite renomear mantendo categoria desativada depois (caso real de produção)', async () => {
      const { service, referencias } = setup();
      const t = await service.create(novo({ categoriaId: 'cat-a2' }));
      referencias.setCategoriaAtiva('cat-a2', false);

      const atualizado = await service.update({
        id: t.id,
        familiaId: FAMILIA_A,
        nome: 'Energia',
        categoriaId: 'cat-a2',
        metodoPagamentoId: 'mp-a',
      });

      expect(atualizado.nome).toBe('Energia');
    });

    it('permite limpar referências com null', async () => {
      const { service } = setup();
      const t = await service.create(novo());

      const atualizado = await service.update({
        id: t.id,
        familiaId: FAMILIA_A,
        metodoPagamentoId: null,
      });

      expect(atualizado.metodoPagamentoId).toBeNull();
    });
  });

  describe('aplicar', () => {
    it('aplica template cuja categoria foi desativada depois (vínculo existente)', async () => {
      const { service, referencias, transacaoCreator } = setup();
      const t = await service.create(novo({ categoriaId: 'cat-a2' }));
      referencias.setCategoriaAtiva('cat-a2', false);

      const result = await service.aplicar({
        familiaId: FAMILIA_A,
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '100.00' }],
      });

      expect(result.transacoesCriadas).toBe(1);
      expect(transacaoCreator.criar).toHaveBeenCalledTimes(1);
    });

    it('não grava nada quando algum template tem referência de outra família (legado)', async () => {
      const { service, repo, transacaoCreator, cofrinhoService } = setup();
      const valido = await service.create(novo({ nome: 'Água' }));
      // Simula dado legado gravado antes desta validação existir.
      const legado = await repo.create(novo({ nome: 'Legado', categoriaId: 'cat-b' }));

      await expect(
        service.aplicar({
          familiaId: FAMILIA_A,
          usuarioId: 'u1',
          mesReferencia: '2026-03',
          itens: [
            { templateId: valido.id, valor: '50.00' },
            { templateId: legado.id, valor: '70.00' },
          ],
        }),
      ).rejects.toBeInstanceOf(ReferenciaInvalidaError);

      expect(transacaoCreator.criar).not.toHaveBeenCalled();
      expect(cofrinhoService.aportar).not.toHaveBeenCalled();
    });
  });
});
