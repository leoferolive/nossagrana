import { InMemoryTransacaoRepository } from './transacao.repository.js';
import type {
  CofrinhoHandler,
  CreateTransacaoInput,
  Transacao,
  TransacaoComCofrinho,
  TransacaoRepository,
} from './transacao.types.js';

/**
 * Fake nomeada: repositório InMemory que lança ao gravar a N-ésima linha
 * (pai = 1ª). `createMany` grava linha a linha, então a falha no meio do lote
 * deixa escrita parcial no staging — exatamente o que a Unit of Work precisa
 * descartar. Cada staging conta do zero (uma execução = uma contagem).
 */
export class InMemoryTransacaoRepositoryFalhaNoEnesimoInsert extends InMemoryTransacaoRepository {
  private inseridas = 0;

  constructor(private readonly falharNoInsert: number) {
    super();
  }

  override async create(input: CreateTransacaoInput): Promise<Transacao> {
    this.inseridas++;
    if (this.inseridas === this.falharNoInsert) {
      throw new Error(
        `Falha simulada no insert nº ${this.falharNoInsert} (data ${input.data}, parcela ${input.parcelaAtual ?? '-'})`,
      );
    }
    return super.create(input);
  }

  override async createMany(inputs: CreateTransacaoInput[]): Promise<Transacao[]> {
    const criadas: Transacao[] = [];
    for (const input of inputs) criadas.push(await this.create(input));
    return criadas;
  }

  protected override criarVazio(): InMemoryTransacaoRepository {
    return new InMemoryTransacaoRepositoryFalhaNoEnesimoInsert(this.falharNoInsert);
  }
}

/**
 * Fake nomeada do handler de cofrinho: registra as transações processadas e
 * lança na chamada `falharNaChamada`. Com `observado`, anota quantas
 * transações estavam visíveis fora da unidade no momento de cada chamada.
 */
export class CofrinhoHandlerQueFalhaNaChamada implements CofrinhoHandler {
  readonly processadas: TransacaoComCofrinho[] = [];
  readonly gravadasVisiveisNaChamada: number[] = [];

  constructor(
    private readonly falharNaChamada: number,
    private readonly observado?: TransacaoRepository,
  ) {}

  async processarTransacaoComCofrinho(transacao: TransacaoComCofrinho): Promise<void> {
    if (this.processadas.length + 1 === this.falharNaChamada) {
      throw new Error(
        `Falha simulada do cofrinho na chamada nº ${this.falharNaChamada} (transação ${transacao.id})`,
      );
    }
    this.processadas.push(transacao);
    if (!this.observado) return;
    const visiveis = await this.observado.list({ familiaId: transacao.familiaId });
    this.gravadasVisiveisNaChamada.push(visiveis.length);
  }
}
