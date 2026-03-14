import { useState } from 'react';

import { useTransacaoStore } from '@/stores/transacao.store';

interface ExtratoPageProps {
  familiaId: string;
  onBack: () => void;
  onNovaTransacao: () => void;
}

type FiltroTipo = 'todos' | 'receita' | 'despesa';

type Transacao = ReturnType<typeof useTransacaoStore.getState>['transacoes'][number];

const formatValor = (valor: string, tipo: 'receita' | 'despesa') => {
  const num = parseFloat(valor);
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
  return tipo === 'receita' ? `+ ${formatted}` : `- ${formatted}`;
};

const TransacaoDetalheModal = ({
  transacao,
  onClose,
}: {
  transacao: Transacao;
  onClose: () => void;
}) => (
  <div
    role="dialog"
    aria-modal="true"
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
  >
    <div className="w-full max-w-lg rounded-t-2xl bg-panel p-5 shadow-soft sm:rounded-2xl">
      <h2 className="mb-4 text-base font-bold text-text">{transacao.descricao ?? 'Transação'}</h2>
      <p className="text-sm text-text-muted">
        {formatValor(transacao.valor, transacao.tipo)}
      </p>
      <p className="mt-1 text-xs text-text-muted">{transacao.data}</p>
      <div className="mt-5">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-border py-2.5 text-sm text-text-muted transition hover:text-text"
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
);

export const ExtratoPage = ({ onBack, onNovaTransacao }: ExtratoPageProps) => {
  const { transacoes, carregando } = useTransacaoStore();

  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<Transacao | null>(null);

  const transacoesFiltradas = transacoes.filter((t) => {
    if (filtroTipo === 'todos') return true;
    return t.tipo === filtroTipo;
  });

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="text-text-muted transition hover:text-text"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-text">Extrato</h1>
      </header>

      {/* Filtros de tipo */}
      <div className="flex gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => setFiltroTipo('todos')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            filtroTipo === 'todos'
              ? 'bg-text text-bg'
              : 'border border-border text-text-muted hover:text-text'
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          aria-label="Filtrar despesas"
          onClick={() => setFiltroTipo(filtroTipo === 'despesa' ? 'todos' : 'despesa')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            filtroTipo === 'despesa'
              ? 'bg-danger text-white'
              : 'border border-border text-text-muted hover:text-text'
          }`}
        >
          Despesas
        </button>
        <button
          type="button"
          aria-label="Filtrar receitas"
          onClick={() => setFiltroTipo(filtroTipo === 'receita' ? 'todos' : 'receita')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            filtroTipo === 'receita'
              ? 'bg-success text-white'
              : 'border border-border text-text-muted hover:text-text'
          }`}
        >
          Receitas
        </button>
      </div>

      {/* Lista */}
      <main className="flex-1 p-4 pb-24">
        {carregando && (
          <p className="text-center text-sm text-text-muted">Carregando...</p>
        )}

        {!carregando && transacoesFiltradas.length === 0 && (
          <p className="text-center text-sm text-text-muted">Nenhuma transação encontrada.</p>
        )}

        <ul className="flex flex-col gap-2">
          {transacoesFiltradas.map((t) => (
            <li
              key={t.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-panel px-4 py-3 transition hover:bg-surface"
              onClick={() => setTransacaoSelecionada(t)}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-text">{t.descricao}</span>
                <div className="flex flex-wrap gap-1">
                  {t.parcelado && t.parcelaAtual != null && t.numeroParcelas != null && (
                    <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">
                      Parcela {t.parcelaAtual}/{t.numeroParcelas}
                    </span>
                  )}
                  {t.recorrente && (
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                      Recorrente
                    </span>
                  )}
                  <span className="text-xs text-text-muted">{t.data}</span>
                </div>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  t.tipo === 'receita' ? 'text-success' : 'text-danger'
                }`}
              >
                {formatValor(t.valor, t.tipo)}
              </span>
            </li>
          ))}
        </ul>
      </main>

      {/* FAB */}
      <button
        type="button"
        aria-label="Nova transação"
        onClick={onNovaTransacao}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-white shadow-lg transition hover:bg-success-strong"
      >
        +
      </button>

      {/* Modal de detalhe */}
      {transacaoSelecionada && (
        <TransacaoDetalheModal
          transacao={transacaoSelecionada}
          onClose={() => setTransacaoSelecionada(null)}
        />
      )}
    </div>
  );
};
