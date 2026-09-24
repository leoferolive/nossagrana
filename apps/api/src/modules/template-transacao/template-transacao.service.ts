import type {
  ReferenciaEsperada,
  ReferenciaOwnershipChecker,
} from '../../shared/referencia-ownership/referencia-ownership.types.js';
import { referenciaEsperada } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import type { UnitOfWork } from '../../shared/unit-of-work/unit-of-work.types.js';
import { aportarNoEscopo } from '../cofrinho/cofrinho.operacoes.js';
import type { BuscarCategoriaCofrinho, CofrinhoRepositorios } from '../cofrinho/cofrinho.types.js';
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

export class TemplateTransacaoService {
  constructor(
    private readonly repository: TemplateTransacaoRepository,
    private readonly unitOfWork: UnitOfWork<CofrinhoRepositorios>,
    private readonly buscarCategoriaCofrinho: BuscarCategoriaCofrinho,
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

  /**
   * Lançamentos e aportes de todos os itens numa única Unit of Work (#89):
   * validação e leituras antes; dentro da unidade só escritas pelos `repos`
   * do tx — um aporte que falha (ex.: cofrinho encerrado numa corrida)
   * desfaz também os lançamentos já gravados.
   */
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
    const lancamentos = planos.filter(ehLancamento);
    const aportes = await this.comCategoriaCofrinho(planos.filter(ehAporte), input.familiaId);

    await this.unitOfWork.executar(async ({ repos }) => {
      for (const item of lancamentos) await criarLancamento(repos, item, contexto);
      for (const item of aportes) await aportarItem(repos, item, contexto);
    });
    const total = lancamentos.length + aportes.length;
    return { transacoesCriadas: lancamentos.length, aportesCriados: aportes.length, total };
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

  /**
   * Categoria de sistema "Cofrinho" lida uma vez, fora da unidade, só se houver
   * aporte; aportes saem ordenados por `cofrinhoId` (os lançamentos mantêm a
   * ordem dos itens — não travam linha de cofrinho).
   */
  private async comCategoriaCofrinho(
    aportes: AportePlanejado[],
    familiaId: string,
  ): Promise<Array<AportePlanejado & { categoriaId: string }>> {
    if (aportes.length === 0) return [];
    const { id: categoriaId } = await this.buscarCategoriaCofrinho(familiaId);
    // Ordem global de locks: duas aplicações concorrentes com os mesmos
    // cofrinhos em ordens opostas travariam em deadlock (40P01) sem isto.
    return [...aportes].sort(porCofrinhoId).map((aporte) => ({ ...aporte, categoriaId }));
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

interface LancamentoPlanejado {
  tipo: 'lancamento';
  template: TemplateTransacao;
  valor: string;
  categoriaId: string;
}

interface AportePlanejado {
  tipo: 'aporte';
  template: TemplateTransacao;
  valor: string;
  cofrinhoId: string;
}

type ItemPlanejado = LancamentoPlanejado | AportePlanejado;

interface ContextoAplicacao {
  familiaId: string;
  usuarioId: string;
  mesReferencia: string;
  data: string;
}

const ehLancamento = (item: ItemPlanejado): item is LancamentoPlanejado =>
  item.tipo === 'lancamento';

const ehAporte = (item: ItemPlanejado): item is AportePlanejado => item.tipo === 'aporte';

/** Ordem por unidade de código (não `localeCompare`): igual em qualquer processo/locale. */
const porCofrinhoId = (a: AportePlanejado, b: AportePlanejado): number =>
  a.cofrinhoId < b.cofrinhoId ? -1 : Number(a.cofrinhoId > b.cofrinhoId);

/**
 * Template com cofrinho vira aporte; sem cofrinho, vira transação e precisa de
 * categoria. Resolvido antes da unidade para não gravar parcialmente (issue #57).
 */
function planejarItem(template: TemplateTransacao | undefined, valor: string): ItemPlanejado {
  if (!template) throw new TemplateNotFoundError();
  if (template.cofrinhoId)
    return { tipo: 'aporte', template, valor, cofrinhoId: template.cofrinhoId };
  if (!template.categoriaId) throw new TemplateSemCategoriaError();
  return { tipo: 'lancamento', template, valor, categoriaId: template.categoriaId };
}

async function criarLancamento(
  repos: CofrinhoRepositorios,
  { template, valor, categoriaId }: LancamentoPlanejado,
  contexto: ContextoAplicacao,
): Promise<void> {
  await repos.transacoes.create({
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

/** Mesmo fluxo atômico do POST /cofrinhos/:id/aportes, nos `repos` desta unidade. */
async function aportarItem(
  repos: CofrinhoRepositorios,
  { template, valor, cofrinhoId, categoriaId }: AportePlanejado & { categoriaId: string },
  contexto: ContextoAplicacao,
): Promise<void> {
  await aportarNoEscopo(repos, {
    cofrinhoId,
    familiaId: contexto.familiaId,
    valor,
    descricao: template.nome,
    registradoPor: contexto.usuarioId,
    mesReferencia: contexto.mesReferencia,
    data: contexto.data,
    categoriaId,
  });
}

function comTipo(
  referencia: ReferenciaEsperada | undefined,
  tipo: 'receita' | 'despesa',
): (ReferenciaEsperada & { tipo: 'receita' | 'despesa' }) | undefined {
  return referencia && { ...referencia, tipo };
}
