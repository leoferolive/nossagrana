import { describe, it, expect, beforeEach } from 'vitest';

import {
  CATEGORIA_COFRINHO_FAKE,
  montarRepositoriosCofrinhoInMemory,
  type RepositoriosCofrinhoInMemory,
} from '../cofrinho/cofrinho.fakes.js';
import { CofrinhoEncerradoError } from '../cofrinho/cofrinho.errors.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import {
  TemplateTransacaoService,
  TemplateNotFoundError,
  TemplateTransacaoDuplicateError,
  TemplateSemCategoriaError,
} from './template-transacao.service.js';
import type { TemplateTransacaoRepository } from './template-transacao.types.js';

describe('TemplateTransacaoService', () => {
  let repo: TemplateTransacaoRepository;
  let service: TemplateTransacaoService;
  let ctx: RepositoriosCofrinhoInMemory;

  beforeEach(() => {
    repo = new InMemoryTemplateTransacaoRepository();
    ctx = montarRepositoriosCofrinhoInMemory();
    service = new TemplateTransacaoService(
      repo,
      ctx.instrumentada,
      ctx.buscarCategoriaCofrinho,
      new ReferenciasSempreValidasFake(),
    );
  });

  const transacoesDe = (familiaId = 'f1') => ctx.transacoes.list({ familiaId });

  const cofrinhoAtivo = async (familiaId = 'f1') =>
    (await ctx.cofrinhos.create({ familiaId, nome: 'Reserva', criadoPor: 'u1' })).id;

  describe('create', () => {
    it('cria template com sucesso', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      expect(t.nome).toBe('Luz');
      expect(t.ativo).toBe(true);
    });

    it('rejeita duplicata (mesmo nome + tipo + família)', async () => {
      await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      await expect(
        service.create({
          familiaId: 'f1',
          nome: 'Luz',
          tipo: 'despesa',
          categoriaId: 'c2',
          criadoPor: 'u1',
        }),
      ).rejects.toThrow(TemplateTransacaoDuplicateError);
    });
  });

  describe('update', () => {
    it('atualiza template existente', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const updated = await service.update({ id: t.id, familiaId: 'f1', nome: 'Energia Elétrica' });
      expect(updated.nome).toBe('Energia Elétrica');
    });

    it('lança erro se template não encontrado', async () => {
      await expect(
        service.update({ id: 'inexistente', familiaId: 'f1', nome: 'X' }),
      ).rejects.toThrow(TemplateNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('desativa template', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const result = await service.deactivate({ id: t.id, familiaId: 'f1' });
      expect(result.ativo).toBe(false);
    });
  });

  describe('aplicar', () => {
    it('cria transações normais para templates sem cofrinho', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '285.71' }],
      });
      expect(result.transacoesCriadas).toBe(1);
      expect(result.aportesCriados).toBe(0);
      const [transacao] = await transacoesDe();
      expect(transacao).toMatchObject({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '285.71',
        categoriaId: 'c1',
        descricao: 'Luz',
        data: '2026-03-01',
        mesReferencia: '2026-03',
        usuarioRegistrouId: 'u1',
        cofrinhoId: null,
      });
    });

    it('aporta pelo fluxo atômico do cofrinho para templates com cofrinhoId', async () => {
      const cofrinhoId = await cofrinhoAtivo();
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Fundo Emergência',
        tipo: 'despesa',
        cofrinhoId,
        criadoPor: 'u1',
      });
      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '200.00' }],
      });
      expect(result.aportesCriados).toBe(1);
      expect(result.transacoesCriadas).toBe(0);
      const cofrinho = await ctx.cofrinhos.findById({ id: cofrinhoId, familiaId: 'f1' });
      expect(cofrinho?.saldoAtual).toBe('200.00');
      const [movimentacao] = await ctx.movimentacoes.listByCofrinho({
        cofrinhoId,
        familiaId: 'f1',
      });
      expect(movimentacao).toMatchObject({
        tipo: 'aporte',
        valor: '200.00',
        descricao: 'Fundo Emergência',
        registradoPor: 'u1',
        mesReferencia: '2026-03',
      });
      const [transacao] = await transacoesDe();
      expect(transacao).toMatchObject({
        id: movimentacao?.transacaoId,
        cofrinhoId,
        categoriaId: CATEGORIA_COFRINHO_FAKE,
        data: '2026-03-01',
      });
    });

    it('grava lançamentos e aportes numa única unidade de trabalho (#89)', async () => {
      const cofrinhoId = await cofrinhoAtivo();
      const luz = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const reserva = await service.create({
        familiaId: 'f1',
        nome: 'Reserva',
        tipo: 'despesa',
        cofrinhoId,
        criadoPor: 'u1',
      });

      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [
          { templateId: luz.id, valor: '100.00' },
          { templateId: reserva.id, valor: '50.00' },
        ],
      });

      expect(result).toEqual({ transacoesCriadas: 1, aportesCriados: 1, total: 2 });
      expect(ctx.uow.estatisticas()).toEqual({ iniciadas: 1, confirmadas: 1, desfeitas: 0 });
    });

    it('aporta em ordem de cofrinhoId, qualquer que seja a ordem dos itens (evita deadlock)', async () => {
      const ids = [await cofrinhoAtivo(), await cofrinhoAtivo(), await cofrinhoAtivo()];
      const templates = [];
      for (const cofrinhoId of ids) {
        templates.push(
          await service.create({
            familiaId: 'f1',
            nome: `R-${cofrinhoId}`,
            tipo: 'despesa',
            cofrinhoId,
            criadoPor: 'u1',
          }),
        );
      }
      const itens = [...templates]
        .sort((a, b) => (b.cofrinhoId ?? '').localeCompare(a.cofrinhoId ?? ''))
        .map((t) => ({ templateId: t.id, valor: '1.00' }));

      await service.aplicar({ familiaId: 'f1', usuarioId: 'u1', mesReferencia: '2026-03', itens });

      const ordemGravada = (await transacoesDe()).map((t) => t.cofrinhoId);
      expect(ordemGravada).toEqual([...ids].sort());
    });

    it('falha no aporte desfaz também os lançamentos já gravados na aplicação', async () => {
      const cofrinhoId = await cofrinhoAtivo();
      const luz = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const reserva = await service.create({
        familiaId: 'f1',
        nome: 'Reserva',
        tipo: 'despesa',
        cofrinhoId,
        criadoPor: 'u1',
      });
      ctx.instrumentada.falharApos('movimentacoes.create');

      await expect(
        service.aplicar({
          familiaId: 'f1',
          usuarioId: 'u1',
          mesReferencia: '2026-03',
          itens: [
            { templateId: luz.id, valor: '100.00' },
            { templateId: reserva.id, valor: '50.00' },
          ],
        }),
      ).rejects.toThrow('Falha injetada');

      expect(await transacoesDe()).toEqual([]);
      expect((await ctx.cofrinhos.findById({ id: cofrinhoId, familiaId: 'f1' }))?.saldoAtual).toBe(
        '0',
      );
    });

    it('cofrinho encerrado após a validação (corrida) aborta a aplicação inteira', async () => {
      const cofrinhoId = await cofrinhoAtivo();
      const luz = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const reserva = await service.create({
        familiaId: 'f1',
        nome: 'Reserva',
        tipo: 'despesa',
        cofrinhoId,
        criadoPor: 'u1',
      });
      await ctx.cofrinhos.encerrar({ id: cofrinhoId, familiaId: 'f1' });

      await expect(
        service.aplicar({
          familiaId: 'f1',
          usuarioId: 'u1',
          mesReferencia: '2026-03',
          itens: [
            { templateId: luz.id, valor: '100.00' },
            { templateId: reserva.id, valor: '50.00' },
          ],
        }),
      ).rejects.toThrow(CofrinhoEncerradoError);

      expect(await transacoesDe()).toEqual([]);
    });

    it('filtra itens com valor zero', async () => {
      const t1 = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const t2 = await service.create({
        familiaId: 'f1',
        nome: 'Gás',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [
          { templateId: t1.id, valor: '285.71' },
          { templateId: t2.id, valor: '0' },
        ],
      });
      expect(result.total).toBe(1);
      expect(await transacoesDe()).toHaveLength(1);
    });

    it('lança erro se template sem cofrinho não tem categoriaId', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Sem Categoria',
        tipo: 'despesa',
        criadoPor: 'u1',
      });
      await expect(
        service.aplicar({
          familiaId: 'f1',
          usuarioId: 'u1',
          mesReferencia: '2026-03',
          itens: [{ templateId: t.id, valor: '100.00' }],
        }),
      ).rejects.toThrow(TemplateSemCategoriaError);
    });

    it('lança erro se template não pertence à família', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      await expect(
        service.aplicar({
          familiaId: 'f2',
          usuarioId: 'u2',
          mesReferencia: '2026-03',
          itens: [{ templateId: t.id, valor: '100' }],
        }),
      ).rejects.toThrow(TemplateNotFoundError);
    });
  });
});
