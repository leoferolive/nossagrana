import { useEffect, useState } from 'react';

import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { coreFinanceiroService } from '../services/core-financeiro.service';

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

  const loadOrcamentos = async () => {
    setLoading(true);
    setErro(null);
    try {
      const result = await coreFinanceiroService.getOrcamentos(familiaId);
      setOrcamentos(result.orcamentos as OrcamentoItem[]);
    } catch {
      setErro('Erro ao carregar orçamentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrcamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const handleEditar = (item: OrcamentoItem) => {
    setEditingId(item.categoriaId);
    setNovoLimite(item.valorLimite);
  };

  const handleSalvar = async (categoriaId: string) => {
    await coreFinanceiroService.setOrcamento(familiaId, categoriaId, {
      valorLimite: novoLimite,
      vigenciaInicio: getCurrentMes(),
    });
    setEditingId(null);
    setNovoLimite('');
    await loadOrcamentos();
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
          { title: 'Orçamento', description: 'Defina limites de gasto por categoria para controlar suas finanças.' },
          { title: 'Progresso', description: 'A barra mostra quanto do limite já foi utilizado no mês.' },
          { title: 'Editar limite', description: 'Toque em "Editar limite" para ajustar o valor máximo de cada categoria.' },
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
        <h1 className="text-xl font-bold text-text">Orçamento</h1>
      </header>

      <ErrorBanner error={erro} />
      <main className="flex flex-1 flex-col gap-4 p-4">
        {orcamentos.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum orçamento configurado.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {orcamentos.map((item) => (
              <div key={item.categoriaId} className="rounded-xl border border-border bg-panel p-4">
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
                      type="number"
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
                  <button
                    type="button"
                    aria-label="Editar limite"
                    onClick={() => handleEditar(item)}
                    className="text-sm text-primary hover:underline"
                  >
                    Editar limite
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
