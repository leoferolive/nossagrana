import { useEffect, useState } from 'react';

import { Target } from 'lucide-react';

import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { coreFinanceiroService, categoriaService } from '../services/core-financeiro.service';

interface OrcamentoItem {
  id: string;
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  totalGasto: string;
  percentual: number;
  status: 'ok' | 'warning' | 'exceeded';
}

interface OrcamentoPageProps {
  familiaId: string;
  onBack: () => void;
}

const statusColor: Record<string, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  exceeded: 'bg-danger',
};

const statusTextColor: Record<string, string> = {
  ok: 'text-success',
  warning: 'text-warning',
  exceeded: 'text-danger',
};

const getCurrentMes = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const OrcamentoPage = ({ familiaId, onBack }: OrcamentoPageProps) => {
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [novoLimite, setNovoLimite] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<
    { id: string; nome: string }[]
  >([]);
  const [addCategoriaId, setAddCategoriaId] = useState('');
  const [addValorLimite, setAddValorLimite] = useState('');

  const loadOrcamentos = async () => {
    setLoading(true);
    setErro(null);
    try {
      const result = await coreFinanceiroService.getOrcamentos(familiaId);
      const items = result.orcamentos as OrcamentoItem[];
      setOrcamentos(items);
      await loadCategoriasDisponiveis(items.map((o) => o.categoriaId));
    } catch {
      setErro('Erro ao carregar orçamentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoriasDisponiveis = async (orcamentosCategoriaIds: string[]) => {
    try {
      const result = await categoriaService.listar(familiaId);
      const despesas = result.categorias.filter(
        (c) => c.tipo === 'despesa' && c.ativo && !orcamentosCategoriaIds.includes(c.id),
      );
      setCategoriasDisponiveis(despesas.map((c) => ({ id: c.id, nome: c.nome })));
    } catch {
      // silently fail — categorias are non-critical here
    }
  };

  useEffect(() => {
    void loadOrcamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const handleOpenAddForm = () => {
    setShowAddForm(true);
    setAddCategoriaId('');
    setAddValorLimite('');
  };

  const handleAddSalvar = async () => {
    if (!addCategoriaId || !addValorLimite) return;
    try {
      await coreFinanceiroService.setOrcamento(familiaId, addCategoriaId, {
        valorLimite: addValorLimite,
        vigenciaInicio: getCurrentMes(),
      });
      setShowAddForm(false);
      setAddCategoriaId('');
      setAddValorLimite('');
      await loadOrcamentos();
    } catch {
      setErro('Erro ao salvar orçamento. Tente novamente.');
    }
  };

  const handleEditar = (item: OrcamentoItem) => {
    setEditingId(item.categoriaId);
    setNovoLimite(item.valorLimite);
  };

  const handleSalvar = async (categoriaId: string) => {
    try {
      await coreFinanceiroService.setOrcamento(familiaId, categoriaId, {
        valorLimite: novoLimite,
        vigenciaInicio: getCurrentMes(),
      });
      setEditingId(null);
      setNovoLimite('');
      await loadOrcamentos();
    } catch {
      setErro('Erro ao salvar orçamento. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <FirstTimeTour
        tourKey="orcamento"
        steps={[
          {
            icon: '🎯',
            title: 'Orçamento mensal',
            description:
              'Defina quanto deseja gastar no máximo por categoria. O controle ajuda a evitar surpresas no fim do mês.',
          },
          {
            icon: '📊',
            title: 'Barra de progresso',
            description:
              'A barra muda de cor: verde = dentro do limite, amarelo = 80% usado, vermelho = estourou.',
          },
          {
            icon: '✏️',
            title: 'Ajustar limites',
            description:
              'Toque em "Editar limite" para alterar o valor. A mudança vale a partir de agora e o histórico anterior é preservado.',
          },
        ]}
      />
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-surface"
        >
          ← Voltar
        </button>
        <div>
          <h1 className="text-xl font-bold text-text">Orçamento Mensal</h1>
          {orcamentos.length > 0 && orcamentos[0].vigenciaInicio && (
            <p className="text-xs text-text-muted">
              Vigente desde{' '}
              {new Date(orcamentos[0].vigenciaInicio + '-01').toLocaleDateString('pt-BR', {
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </header>

      <ErrorBanner error={erro} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Formulário de adicionar categoria */}
        {showAddForm && (
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="mb-3 text-sm font-semibold text-text">Adicionar categoria ao orçamento</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="add-categoria" className="mb-1 block text-xs text-text-muted">
                  Categoria
                </label>
                <select
                  id="add-categoria"
                  aria-label="Categoria"
                  value={addCategoriaId}
                  onChange={(e) => setAddCategoriaId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione...</option>
                  {categoriasDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="add-valor-limite" className="mb-1 block text-xs text-text-muted">
                  Valor limite
                </label>
                <input
                  id="add-valor-limite"
                  aria-label="Valor limite"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 500.00"
                  value={addValorLimite}
                  onChange={(e) => setAddValorLimite(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleAddSalvar()}
                  className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success-strong"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {orcamentos.length === 0 && !showAddForm ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface">
              <Target size={32} className="text-text-muted" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Nenhum orçamento configurado</h2>
              <p className="mt-1 max-w-sm text-sm text-text-muted">
                Defina limites mensais de gasto por categoria para acompanhar se suas despesas estão
                dentro do planejado.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success-strong"
            >
              Configurar Orçamento
            </button>
          </div>
        ) : orcamentos.length === 0 ? null : (
          <>
            {!showAddForm && (
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="self-start rounded-lg border border-dashed border-border px-4 py-2 text-sm text-text-muted transition hover:border-success hover:text-success"
              >
                + Adicionar Categoria
              </button>
            )}
            {/* Mobile: cards com BudgetBar */}
            <div className="flex flex-col gap-3 md:hidden">
              {orcamentos.map((item) => (
                <div
                  key={item.categoriaId}
                  className="rounded-xl border border-border bg-panel p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-text">{item.categoriaNome}</span>
                    <span className="text-sm text-text-muted">
                      {item.percentual.toFixed(0)}% — {formatBRL(item.totalGasto)}/
                      {formatBRL(item.valorLimite)}
                    </span>
                  </div>

                  <div className="mb-3 h-2 w-full rounded-full bg-surface">
                    <div
                      className={`h-2 rounded-full ${statusColor[item.status]}`}
                      style={{ width: `${Math.min(item.percentual, 100)}%` }}
                    />
                  </div>

                  {editingId === item.categoriaId ? (
                    <div className="flex items-center gap-2">
                      <label htmlFor={`limite-${item.categoriaId}`} className="sr-only">
                        Novo limite
                      </label>
                      <input
                        id={`limite-${item.categoriaId}`}
                        aria-label="Novo limite"
                        type="text"
                        inputMode="decimal"
                        pattern="^\d+(\.\d{1,2})?$"
                        value={novoLimite}
                        onChange={(e) => setNovoLimite(e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSalvar(item.categoriaId)}
                        className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success-strong"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        aria-label="Editar limite"
                        onClick={() => handleEditar(item)}
                        className="text-xs text-text-muted transition hover:text-text"
                      >
                        editar limite
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block">
              <div className="overflow-hidden rounded-xl border border-border bg-panel">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-text-muted">
                        Limite
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-text-muted">
                        Gasto
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-text-muted">
                        Disponível
                      </th>
                      <th className="w-40 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-muted">
                        Progresso
                      </th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-muted" />
                    </tr>
                  </thead>
                  <tbody>
                    {orcamentos.map((item) => {
                      const limite = parseFloat(item.valorLimite);
                      const gasto = parseFloat(item.totalGasto);
                      const disponivel = limite - gasto;
                      return (
                        <tr key={item.categoriaId} className="border-b border-border">
                          <td className="px-4 py-3.5 text-sm font-semibold text-text">
                            {item.categoriaNome}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm text-text-muted">
                            {formatBRL(item.valorLimite)}
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-semibold text-text">
                            {formatBRL(item.totalGasto)}
                          </td>
                          <td
                            className={`px-4 py-3.5 text-right text-sm font-bold ${disponivel >= 0 ? 'text-success' : 'text-danger'}`}
                          >
                            {disponivel >= 0 ? '' : '-'}
                            {formatBRL(Math.abs(disponivel).toFixed(2))}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-surface">
                                <div
                                  className={`h-1.5 rounded-full ${statusColor[item.status]}`}
                                  style={{
                                    width: `${Math.min(item.percentual, 100)}%`,
                                  }}
                                />
                              </div>
                              <span
                                className={`min-w-[32px] text-right text-xs font-bold ${statusTextColor[item.status]}`}
                              >
                                {item.percentual.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {editingId === item.categoriaId ? (
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`limite-desktop-${item.categoriaId}`}
                                  className="sr-only"
                                >
                                  Novo limite
                                </label>
                                <input
                                  id={`limite-desktop-${item.categoriaId}`}
                                  aria-label="Novo limite"
                                  type="text"
                                  inputMode="decimal"
                                  value={novoLimite}
                                  onChange={(e) => setNovoLimite(e.target.value)}
                                  className="w-24 rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSalvar(item.categoriaId)}
                                  className="rounded-lg bg-success px-3 py-1 text-xs font-semibold text-white hover:bg-success-strong"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="text-xs text-text-muted hover:text-text"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-label="Editar limite"
                                onClick={() => handleEditar(item)}
                                className="text-xs text-text-muted transition hover:text-text"
                              >
                                editar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
