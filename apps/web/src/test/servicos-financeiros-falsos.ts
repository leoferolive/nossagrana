import { vi } from 'vitest';

/**
 * Fake nomeada dos serviços que o painel de lançar chama ao abrir (categorias, formas de
 * pagamento e os lançamentos recentes que ordenam os chips): respondem vazio, sem rede.
 * Uso: `vi.mock('@/services/core-financeiro.service', async () =>
 * (await import('@/test/servicos-financeiros-falsos')).servicosFinanceirosFalsos)`.
 */
export const servicosFinanceirosFalsos = {
  transacaoService: { listar: vi.fn() },
  categoriaService: { listar: vi.fn().mockResolvedValue({ categorias: [] }) },
  metodoPagamentoService: { listar: vi.fn().mockResolvedValue({ metodosPagamento: [] }) },
};
