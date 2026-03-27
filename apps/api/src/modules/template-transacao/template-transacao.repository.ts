import { randomUUID } from 'node:crypto';

import type {
  CreateTemplateTransacaoInput,
  ReordenarItem,
  TemplateTransacao,
  TemplateTransacaoRepository,
  TemplateTransacaoWithJoins,
  UpdateTemplateTransacaoInput,
} from './template-transacao.types.js';

export class InMemoryTemplateTransacaoRepository implements TemplateTransacaoRepository {
  private templates: TemplateTransacao[] = [];

  async listByFamiliaId(input: { familiaId: string; tipo?: 'receita' | 'despesa' }): Promise<TemplateTransacaoWithJoins[]> {
    return this.templates
      .filter((t) => t.familiaId === input.familiaId && t.ativo && (!input.tipo || t.tipo === input.tipo))
      .sort((a, b) => a.ordem - b.ordem)
      .map((t) => ({ ...t, categoriaNome: null, metodoPagamentoNome: null, cofrinhoNome: null, cofrinhoEmoji: null }));
  }

  async findById(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    return this.templates.find((t) => t.id === input.id && t.familiaId === input.familiaId) ?? null;
  }

  async findByIds(input: { ids: string[]; familiaId: string }): Promise<TemplateTransacao[]> {
    return this.templates.filter((t) => input.ids.includes(t.id) && t.familiaId === input.familiaId && t.ativo);
  }

  async create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const template: TemplateTransacao = {
      id: randomUUID(),
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
      categoriaId: input.categoriaId ?? null,
      metodoPagamentoId: input.metodoPagamentoId ?? null,
      cofrinhoId: input.cofrinhoId ?? null,
      ordem: input.ordem ?? 0,
      valorPadrao: input.valorPadrao ?? null,
      ativo: true,
      criadoPor: input.criadoPor,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    this.templates.push(template);
    return template;
  }

  async update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao | null> {
    const idx = this.templates.findIndex((t) => t.id === input.id && t.familiaId === input.familiaId);
    if (idx === -1) return null;
    const current = this.templates[idx];
    const updated: TemplateTransacao = {
      ...current,
      nome: input.nome ?? current.nome,
      categoriaId: input.categoriaId !== undefined ? input.categoriaId : current.categoriaId,
      metodoPagamentoId: input.metodoPagamentoId !== undefined ? input.metodoPagamentoId : current.metodoPagamentoId,
      cofrinhoId: input.cofrinhoId !== undefined ? input.cofrinhoId : current.cofrinhoId,
      ordem: input.ordem ?? current.ordem,
      valorPadrao: input.valorPadrao !== undefined ? input.valorPadrao : current.valorPadrao,
      atualizadoEm: new Date(),
    };
    this.templates[idx] = updated;
    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    const idx = this.templates.findIndex((t) => t.id === input.id && t.familiaId === input.familiaId);
    if (idx === -1) return null;
    this.templates[idx] = { ...this.templates[idx], ativo: false, atualizadoEm: new Date() };
    return this.templates[idx];
  }

  async reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void> {
    for (const item of input.itens) {
      const idx = this.templates.findIndex((t) => t.id === item.id && t.familiaId === input.familiaId);
      if (idx !== -1) {
        this.templates[idx] = { ...this.templates[idx], ordem: item.ordem, atualizadoEm: new Date() };
      }
    }
  }
}
