import type {
  ReferenciaEsperada,
  ReferenciaOwnershipChecker,
} from '../../shared/referencia-ownership/referencia-ownership.types.js';
import { referenciaEsperada } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import type {
  CreateTemplateTransacaoInput,
  ReordenarItem,
  TemplateTransacao,
  TemplateTransacaoRepository,
  TemplateTransacaoWithJoins,
  UpdateTemplateTransacaoInput,
} from './template-transacao.types.js';

export class TemplateNotFoundError extends Error {
  constructor() {
    super('Template não encontrado');
  }
}

export class TemplateTransacaoDuplicateError extends Error {
  constructor() {
    super('Já existe um template com este nome e tipo nesta família');
  }
}

export class TemplateSemCategoriaError extends Error {
  constructor() {
    super('Template sem cofrinho precisa ter categoria associada');
  }
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
    private readonly referencias: ReferenciaOwnershipChecker,
  ) {}

  async listByFamiliaId(input: {
    familiaId: string;
    tipo?: 'receita' | 'despesa';
  }): Promise<TemplateTransacaoWithJoins[]> {
    return this.repository.listByFamiliaId(input);
  }

  async create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const existing = await this.repository.listByFamiliaId({ familiaId: input.familiaId });
    const duplicate = existing.find((t) => t.nome === input.nome && t.tipo === input.tipo);
    if (duplicate) throw new TemplateTransacaoDuplicateError();
    await this.referencias.validar({
      familiaId: input.familiaId,
      categoria: comTipo(referenciaEsperada(input.categoriaId), input.tipo),
      metodoPagamento: referenciaEsperada(input.metodoPagamentoId),
      cofrinho: referenciaEsperada(input.cofrinhoId),
    });
    return this.repository.create(input);
  }

  async update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const atual = await this.repository.findById({ id: input.id, familiaId: input.familiaId });
    if (!atual) throw new TemplateNotFoundError();
    // undefined = campo não enviado, null = vínculo removido: nada a validar em ambos.
    await this.referencias.validar({
      familiaId: input.familiaId,
      categoria: comTipo(referenciaEsperada(input.categoriaId, atual.categoriaId), atual.tipo),
      metodoPagamento: referenciaEsperada(input.metodoPagamentoId, atual.metodoPagamentoId),
      cofrinho: referenciaEsperada(input.cofrinhoId, atual.cofrinhoId),
    });
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

    // Toda validação acontece aqui, antes da primeira mutação (issue #57).
    const planos = await this.planejarAplicacao(input.familiaId, itensValidos);
    const contexto = { ...input, data: `${input.mesReferencia}-01` };
    let transacoesCriadas = 0;
    let aportesCriados = 0;

    for (const plano of planos) {
      const criado = await this.executarItem(plano, contexto);
      if (criado === 'aporte') aportesCriados++;
      else transacoesCriadas++;
    }

    return { transacoesCriadas, aportesCriados, total: transacoesCriadas + aportesCriados };
  }

  private async planejarAplicacao(
    familiaId: string,
    itens: Array<{ templateId: string; valor: string }>,
  ): Promise<ItemPlanejado[]> {
    const ids = itens.map((i) => i.templateId);
    const templates = await this.repository.findByIds({ ids, familiaId });
    if (templates.length !== ids.length) throw new TemplateNotFoundError();
    await this.validarVinculosGravados(templates);
    const templateMap = new Map(templates.map((t) => [t.id, t]));
    return itens.map((item) => planejarItem(templateMap.get(item.templateId), item.valor));
  }

  private async executarItem(
    plano: ItemPlanejado,
    contexto: ContextoAplicacao,
  ): Promise<'aporte' | 'transacao'> {
    if ('cofrinhoId' in plano.destino) {
      await this.aportarItem(plano, plano.destino.cofrinhoId, contexto);
      return 'aporte';
    }
    await this.criarTransacaoItem(plano, plano.destino.categoriaId, contexto);
    return 'transacao';
  }

  private async aportarItem(
    { template, valor }: ItemPlanejado,
    cofrinhoId: string,
    contexto: ContextoAplicacao,
  ): Promise<void> {
    await this.cofrinhoService.aportar({
      cofrinhoId,
      familiaId: contexto.familiaId,
      valor,
      descricao: template.nome,
      registradoPor: contexto.usuarioId,
      mesReferencia: contexto.mesReferencia,
      data: contexto.data,
    });
  }

  private async criarTransacaoItem(
    { template, valor }: ItemPlanejado,
    categoriaId: string,
    contexto: ContextoAplicacao,
  ): Promise<void> {
    await this.transacaoCreator.criar({
      familiaId: contexto.familiaId,
      tipo: template.tipo,
      valor,
      categoriaId,
      descricao: template.nome,
      data: contexto.data,
      mesReferencia: contexto.mesReferencia,
      usuarioRegistrouId: contexto.usuarioId,
      metodoPagamentoId: template.metodoPagamentoId,
    });
  }

  /**
   * Antes de gravar qualquer lançamento: um template legado com referência de
   * outra família aborta a aplicação inteira. A categoria gravada pode estar
   * inativa — em produção todos os templates apontam para categorias
   * desativadas depois (diagnóstico de 2026-09-22, issue #55). Método e
   * cofrinho, ao contrário, precisam estar ativos: cofrinho encerrado faria
   * `aportar` falhar no meio do loop, após lançamentos de templates anteriores
   * (gravação parcial), e método inativo geraria lançamento num método
   * desativado (issue #57).
   */
  private async validarVinculosGravados(templates: TemplateTransacao[]): Promise<void> {
    for (const t of templates) {
      await this.referencias.validar({
        familiaId: t.familiaId,
        categoria: referenciaEsperada(t.categoriaId, t.categoriaId),
        metodoPagamento: referenciaEsperada(t.metodoPagamentoId),
        cofrinho: referenciaEsperada(t.cofrinhoId),
      });
    }
  }
}

type DestinoAplicacao = { cofrinhoId: string } | { categoriaId: string };

interface ItemPlanejado {
  template: TemplateTransacao;
  valor: string;
  destino: DestinoAplicacao;
}

interface ContextoAplicacao {
  familiaId: string;
  usuarioId: string;
  mesReferencia: string;
  data: string;
}

/**
 * Template com cofrinho vira aporte; sem cofrinho, vira transação e precisa de
 * categoria. Resolvido antes do loop para não gravar parcialmente (issue #57).
 */
function planejarItem(template: TemplateTransacao | undefined, valor: string): ItemPlanejado {
  if (!template) throw new TemplateNotFoundError();
  if (template.cofrinhoId) return { template, valor, destino: { cofrinhoId: template.cofrinhoId } };
  if (!template.categoriaId) throw new TemplateSemCategoriaError();
  return { template, valor, destino: { categoriaId: template.categoriaId } };
}

function comTipo(
  referencia: ReferenciaEsperada | undefined,
  tipo: 'receita' | 'despesa',
): (ReferenciaEsperada & { tipo: 'receita' | 'despesa' }) | undefined {
  return referencia && { ...referencia, tipo };
}
