import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import {
  transacaoService,
  metodoPagamentoService,
  categoriaService,
} from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { useTransacaoStore } from '@/stores/transacao.store';
import { formatMesLabel, getCurrentMonth, shiftMonth } from '@/utils/date';
import { formatBRL } from '@/utils/formatting';

type Transacao = ReturnType<typeof useTransacaoStore.getState>['transacoes'][number];

interface ExtratoPageProps {
  familiaId: string;
  onBack: () => void;
  onNovaTransacao: () => void;
  onEditarTransacao?: (transacao: Transacao) => void;
}

type FiltroTipo = 'todos' | 'receita' | 'despesa';

const formatValor = (valor: string, tipo: 'receita' | 'despesa') => {
  const formatted = formatBRL(valor);
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
    onClick={onClose}
  >
    <div
      className="w-full max-w-lg rounded-t-2xl bg-panel p-5 shadow-soft sm:rounded-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="mb-4 text-base font-bold text-text">{transacao.descricao ?? 'Transação'}</h2>
      <p className="text-sm text-text-muted">{formatValor(transacao.valor, transacao.tipo)}</p>
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

const TransacaoBadges = ({ t }: { t: Transacao }) => (
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
  </div>
);

export const ExtratoPage = ({
  familiaId,
  onBack: _onBack,
  onNovaTransacao: _onNovaTransacao,
  onEditarTransacao,
}: ExtratoPageProps) => {
  const { transacoes, carregando } = useTransacaoStore();
  const setTransacoes = useTransacaoStore((s) => s.setTransacoes);
  const setCarregando = useTransacaoStore((s) => s.setCarregando);

  const { metodos } = useMetodoPagamentoStore();
  const { categorias } = useCategoriaStore();

  const [erro, setErro] = useState<string | null>(null);
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState('');
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<Transacao | null>(null);

  const metodosMap = useMemo(() => new Map(metodos.map((m) => [m.id, m.nome])), [metodos]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);

  // Load stores if empty
  useEffect(() => {
    if (!familiaId) return;
    if (metodos.length === 0) {
      metodoPagamentoService
        .listar(familiaId)
        .then((res) => useMetodoPagamentoStore.getState().setMetodos(res.metodosPagamento))
        .catch(() => {
          setErro('Erro ao carregar métodos de pagamento');
        });
    }
    if (categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => useCategoriaStore.getState().setCategorias(res.categorias))
        .catch(() => {
          setErro('Erro ao carregar categorias');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  // Load transactions for selected month
  useEffect(() => {
    if (!familiaId) return;
    setCarregando(true);
    transacaoService
      .listar({ mesReferencia }, familiaId)
      .then((res) => setTransacoes(res.transacoes))
      .catch(() => setTransacoes([]))
      .finally(() => setCarregando(false));
  }, [familiaId, mesReferencia, setCarregando, setTransacoes]);

  const handleMesAnterior = useCallback(() => setMesReferencia((m) => shiftMonth(m, -1)), []);
  const handleMesProximo = useCallback(() => setMesReferencia((m) => shiftMonth(m, 1)), []);

  const mesLabel = formatMesLabel(mesReferencia);
  const isCurrentMonth = mesReferencia === getCurrentMonth();

  const transacoesFiltradas = useMemo(
    () =>
      transacoes.filter((t) => {
        if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) return false;
        if (busca && !(t.descricao ?? '').toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
      }),
    [transacoes, filtroTipo, busca],
  );

  const getMetodoNome = useCallback(
    (id: string | null) => (!id ? '—' : (metodosMap.get(id) ?? '—')),
    [metodosMap],
  );

  const getCategoriaNome = useCallback(
    (id: string | null) => (!id ? '—' : (categoriasMap.get(id) ?? '—')),
    [categoriasMap],
  );

  const exportarCSV = useCallback(() => {
    const headers = ['Data', 'Descrição', 'Categoria', 'Pagamento', 'Tipo', 'Valor'];
    const rows = transacoesFiltradas.map((t) => [
      t.data,
      t.descricao ?? '',
      getCategoriaNome(t.categoriaId),
      getMetodoNome(t.metodoPagamentoId),
      t.tipo,
      t.valor,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-${mesReferencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [transacoesFiltradas, mesReferencia, getCategoriaNome, getMetodoNome]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <ErrorBanner error={erro} />
      <FirstTimeTour
        tourKey="extrato"
        steps={[
          {
            icon: '📋',
            title: 'Seu extrato',
            description:
              'Veja todas as transações do mês. Use as setas ◀ ▶ para navegar entre meses.',
          },
          {
            icon: '🔍',
            title: 'Filtros e busca',
            description:
              'Filtre por receitas ou despesas com os chips. Use a barra de busca para encontrar uma transação específica.',
          },
          {
            icon: '✏️',
            title: 'Editar transação',
            description: 'Toque em qualquer transação para editá-la ou excluí-la.',
          },
          {
            icon: '📥',
            title: 'Exportar CSV',
            description: 'Use o botão "Exportar CSV" para baixar suas transações em planilha.',
          },
        ]}
      />

      {/* Header — título + mês + filtros */}
      <header className="border-b border-border px-4 py-4 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-text md:hidden">Extrato</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleMesAnterior}
              className="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text"
              aria-label="Mês anterior"
            >
              ◀
            </button>
            <span className="min-w-[140px] text-center text-sm capitalize text-text-muted">
              {mesLabel}
            </span>
            <button
              type="button"
              onClick={handleMesProximo}
              disabled={isCurrentMonth}
              className="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Próximo mês"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            onClick={exportarCSV}
            className="rounded-lg border border-border px-3 py-1 text-xs text-text-muted transition hover:bg-surface hover:text-text"
            aria-label="Exportar CSV"
          >
            Exportar CSV
          </button>
        </div>
        <div className="flex gap-2">
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
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição..."
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 p-4 md:px-6">
        {carregando && <p className="text-center text-sm text-text-muted">Carregando...</p>}

        {!carregando && transacoesFiltradas.length === 0 && (
          <p className="text-center text-sm text-text-muted">Nenhuma transação encontrada.</p>
        )}

        {/* Mobile: lista de cards */}
        <ul className="flex flex-col gap-2 md:hidden">
          {transacoesFiltradas.map((t) => (
            <li
              key={t.id}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-panel px-4 py-3 transition hover:bg-surface"
              onClick={() =>
                onEditarTransacao ? onEditarTransacao(t) : setTransacaoSelecionada(t)
              }
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-text">{t.descricao}</span>
                <span className="text-xs text-text-dim">{getCategoriaNome(t.categoriaId)}</span>
                <div className="flex flex-wrap items-center gap-1">
                  <TransacaoBadges t={t} />
                  <span className="text-xs text-text-muted">{t.data}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`text-xs ${t.tipo === 'receita' ? 'text-success' : 'text-danger'}`}
                >
                  {t.tipo === 'receita' ? '\u2191' : '\u2193'}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    t.tipo === 'receita' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatValor(t.valor, t.tipo)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: tabela */}
        {transacoesFiltradas.length > 0 && (
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="pb-2 pr-4 font-semibold">Data</th>
                  <th className="pb-2 pr-4 font-semibold">Descrição</th>
                  <th className="pb-2 pr-4 font-semibold">Categoria</th>
                  <th className="pb-2 pr-4 font-semibold">Pagamento</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {transacoesFiltradas.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={`cursor-pointer border-b border-border/50 hover:bg-card-alt ${idx % 2 === 1 ? 'bg-surface/30' : ''}`}
                    onClick={() =>
                      onEditarTransacao ? onEditarTransacao(t) : setTransacaoSelecionada(t)
                    }
                  >
                    <td className="py-3.5 pr-4 text-text-muted">{t.data}</td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text">{t.descricao}</span>
                        <TransacaoBadges t={t} />
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-text-muted">
                      {getCategoriaNome(t.categoriaId)}
                    </td>
                    <td className="py-3.5 pr-4 text-text-muted">
                      {getMetodoNome(t.metodoPagamentoId)}
                    </td>
                    <td
                      className={`py-3.5 text-right font-semibold tabular-nums ${t.tipo === 'receita' ? 'text-success' : 'text-danger'}`}
                    >
                      {formatValor(t.valor, t.tipo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
