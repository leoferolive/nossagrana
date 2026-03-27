import type {
  CreateTemplateTransacaoInput,
  ReordenarItem,
  TemplateTransacao,
  TemplateTransacaoRepository,
  TemplateTransacaoWithJoins,
  UpdateTemplateTransacaoInput,
} from './template-transacao.types.js';

export class TemplateNotFoundError extends Error {
  constructor() { super('Template não encontrado'); }
}

export class TemplateTransacaoDuplicateError extends Error {
  constructor() { super('Já existe um template com este nome e tipo nesta família'); }
}

interface TransacaoCreator {
  criar(input: {
    familiaId: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    mesReferencia: string;
    usuarioRegistrouId: string;
    metodoPagamentoId?: string | null;
    cofrinhoId?: string | null;
  }): Promise<{ id: string }>;
}

interface CofrinhoAportarService {
  aportar(input: {
    cofrinhoId: string;
    familiaId: string;
    valor: string;
    descricao?: string | null;
    registradoPor: string;
    mesReferencia?: string;
    data?: string;
  }): Promise<unknown>;
}

export class TemplateTransacaoService {
  constructor(
    private readonly repository: TemplateTransacaoRepository,
    private readonly transacaoCreator: TransacaoCreator,
    private readonly cofrinhoService: CofrinhoAportarService,
  ) {}

  async listByFamiliaId(input: { familiaId: string; tipo?: 'receita' | 'despesa' }): Promise<TemplateTransacaoWithJoins[]> {
    return this.repository.listByFamiliaId(input);
  }

  async create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const existing = await this.repository.listByFamiliaId({ familiaId: input.familiaId });
    const duplicate = existing.find((t) => t.nome === input.nome && t.tipo === input.tipo);
    if (duplicate) throw new TemplateTransacaoDuplicateError();
    return this.repository.create(input);
  }

  async update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const updated = await this.repository.update(input);
    if (!updated) throw new TemplateNotFoundError();
    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao> {
    const result = await this.repository.deactivate(input);
    if (!result) throw new TemplateNotFoundError();
    return result;
  }

  async reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void> {
    await this.repository.reordenar(input);
  }

  async aplicar(input: {
    familiaId: string;
    usuarioId: string;
    mesReferencia: string;
    itens: Array<{ templateId: string; valor: string }>;
  }): Promise<{ transacoesCriadas: number; aportesCriados: number; total: number }> {
    const itensValidos = input.itens.filter((i) => parseFloat(i.valor) > 0);
    if (itensValidos.length === 0) return { transacoesCriadas: 0, aportesCriados: 0, total: 0 };

    const templateIds = itensValidos.map((i) => i.templateId);
    const templates = await this.repository.findByIds({ ids: templateIds, familiaId: input.familiaId });
    if (templates.length !== templateIds.length) throw new TemplateNotFoundError();

    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const data = `${input.mesReferencia}-01`;
    let transacoesCriadas = 0;
    let aportesCriados = 0;

    for (const item of itensValidos) {
      const template = templateMap.get(item.templateId)!;
      if (template.cofrinhoId) {
        await this.cofrinhoService.aportar({
          cofrinhoId: template.cofrinhoId,
          familiaId: input.familiaId,
          valor: item.valor,
          descricao: template.nome,
          registradoPor: input.usuarioId,
          mesReferencia: input.mesReferencia,
          data,
        });
        aportesCriados++;
      } else {
        await this.transacaoCreator.criar({
          familiaId: input.familiaId,
          tipo: template.tipo,
          valor: item.valor,
          categoriaId: template.categoriaId!,
          descricao: template.nome,
          data,
          mesReferencia: input.mesReferencia,
          usuarioRegistrouId: input.usuarioId,
          metodoPagamentoId: template.metodoPagamentoId,
        });
        transacoesCriadas++;
      }
    }

    return { transacoesCriadas, aportesCriados, total: transacoesCriadas + aportesCriados };
  }
}
