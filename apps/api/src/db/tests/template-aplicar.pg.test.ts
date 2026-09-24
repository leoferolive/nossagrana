import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarBuscaCategoriaCofrinho } from '../../modules/cofrinho/cofrinho.categoria.js';
import { BarreiraDeTeste, UnitOfWorkInstrumentada } from '../../modules/cofrinho/cofrinho.fakes.js';
import { CofrinhoService } from '../../modules/cofrinho/cofrinho.service.js';
import {
  criarRepositoriosCofrinhoDrizzle,
  criarUnitOfWorkCofrinhoDrizzle,
} from '../../modules/cofrinho/cofrinho.unit-of-work.js';
import { TemplateTransacaoService } from '../../modules/template-transacao/template-transacao.service.js';
import type {
  TemplateTransacao,
  TemplateTransacaoRepository,
} from '../../modules/template-transacao/template-transacao.types.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import { esperandoLock, estadoCofrinho, semearCategoriaCofrinho } from './pg-cofrinho.js';
import { semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * `aplicar` de templates concorrente no PostgreSQL real (#89): duas
 * aplicações com os mesmos cofrinhos em ordens OPOSTAS. Os aportes travam as
 * linhas em ordem de `cofrinhoId`, então a 2ª espera a 1ª em vez de formar
 * deadlock (40P01). A 1ª pausa após travar o primeiro cofrinho; a 2ª só é
 * liberada quando o banco a mostra esperando esse lock.
 */
const RODADAS = [1, 2, 3];

/**
 * Fake nomeada do repositório de templates: o `aplicar` só lê `findByIds`.
 * Não usa o InMemory do módulo porque o arquivo dele importa o singleton `db`
 * (que valida env de produção ao carregar).
 */
class TemplatesDeAporteFake implements TemplateTransacaoRepository {
  private readonly templates: TemplateTransacao[] = [];

  adicionar(familiaId: string, usuarioId: string, cofrinhoId: string): string {
    const agora = new Date();
    const id = `tpl-${cofrinhoId}`;
    this.templates.push({
      id,
      familiaId,
      nome: `Reserva ${cofrinhoId}`,
      tipo: 'despesa',
      categoriaId: null,
      metodoPagamentoId: null,
      cofrinhoId,
      ordem: this.templates.length,
      valorPadrao: null,
      ativo: true,
      criadoPor: usuarioId,
      criadoEm: agora,
      atualizadoEm: agora,
    });
    return id;
  }

  async findByIds(input: { ids: string[]; familiaId: string }) {
    return this.templates.filter(
      (t) => input.ids.includes(t.id) && t.familiaId === input.familiaId,
    );
  }

  listByFamiliaId = naoUsado;
  findById = naoUsado;
  create = naoUsado;
  update = naoUsado;
  deactivate = naoUsado;
  reordenar = naoUsado;
}

async function naoUsado(): Promise<never> {
  throw new Error('TemplatesDeAporteFake: método não usado pelo aplicar');
}

describe('TemplateTransacaoService.aplicar concorrente no PostgreSQL', () => {
  let banco: BancoDescartavel;
  let observador: postgres.Sql;
  let conexaoA: postgres.Sql;
  let conexaoB: postgres.Sql;
  let ana: FamiliaSemeada;
  const templates = new TemplatesDeAporteFake();

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    ana = await semearFamilia(banco.sql, 'Ana');
    await semearCategoriaCofrinho(banco.sql, ana);
    observador = conectar(banco.url);
    conexaoA = conectar(banco.url);
    conexaoB = conectar(banco.url);
  });

  afterAll(async () => {
    await Promise.all([observador?.end(), conexaoA?.end(), conexaoB?.end()]);
    await banco?.descartar();
  });

  function cliente(conexao: postgres.Sql) {
    const db = drizzle(conexao);
    const instrumentada = new UnitOfWorkInstrumentada(criarUnitOfWorkCofrinhoDrizzle(db));
    const service = new TemplateTransacaoService(
      templates,
      instrumentada,
      criarBuscaCategoriaCofrinho(db),
      new ReferenciasSempreValidasFake(),
    );
    return { service, instrumentada };
  }

  async function templateDeAporte(): Promise<{ templateId: string; cofrinhoId: string }> {
    const cofrinhos = new CofrinhoService(
      criarRepositoriosCofrinhoDrizzle(drizzle(banco.sql)),
      criarUnitOfWorkCofrinhoDrizzle(drizzle(banco.sql)),
      criarBuscaCategoriaCofrinho(drizzle(banco.sql)),
    );
    const { id: cofrinhoId } = await cofrinhos.criar({
      familiaId: ana.familiaId,
      nome: 'Reserva',
      criadoPor: ana.usuarioId,
    });
    return {
      templateId: templates.adicionar(ana.familiaId, ana.usuarioId, cofrinhoId),
      cofrinhoId,
    };
  }

  const aplicar = (service: TemplateTransacaoService, templateIds: string[]) =>
    service.aplicar({
      familiaId: ana.familiaId,
      usuarioId: ana.usuarioId,
      mesReferencia: '2026-09',
      itens: templateIds.map((templateId) => ({ templateId, valor: '5.00' })),
    });

  it.each(RODADAS)(
    'rodada %i: ordens opostas não geram deadlock — as duas aplicações confirmam',
    async () => {
      const x = await templateDeAporte();
      const y = await templateDeAporte();
      const a = cliente(conexaoA);
      const b = cliente(conexaoB);
      const barreira = new BarreiraDeTeste();
      a.instrumentada.pausarApos('cofrinhos.incrementarSaldo', barreira);

      const primeira = Promise.allSettled([aplicar(a.service, [x.templateId, y.templateId])]);
      await barreira.alcancada;
      const segunda = Promise.allSettled([aplicar(b.service, [y.templateId, x.templateId])]);
      await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
      barreira.liberar();
      const [[ra], [rb]] = await Promise.all([primeira, segunda]);

      expect([ra.status, rb.status]).toEqual(['fulfilled', 'fulfilled']);
      for (const { cofrinhoId } of [x, y]) {
        const estado = await estadoCofrinho(observador, cofrinhoId);
        expect(estado).toMatchObject({ saldo: '10.00', aportes: 2, transacoes: 2 });
        expect(estado.saldoLedger).toBe(estado.saldo);
      }
    },
  );
});
