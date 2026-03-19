import { useEffect, useState } from 'react';

import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { MiniChart } from '../components/charts/mini-chart';

import type { HistoricoDetalheResponse, HistoricoMesItem } from '@nossagrana/types';

import { coreFinanceiroService } from '../services/core-financeiro.service';

interface HistoricoPageProps {
  familiaId: string;
  onBack: () => void;
}

const MES_NOMES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const formatMes = (mesReferencia: string): string => {
  const [ano, mes] = mesReferencia.split('-');
  return `${MES_NOMES[parseInt(mes) - 1]} ${ano}`;
};

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const HistoricoPage = ({ familiaId, onBack }: HistoricoPageProps) => {
  const [meses, setMeses] = useState<HistoricoMesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<HistoricoDetalheResponse | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);

  const loadMeses = async () => {
    setLoading(true);
    try {
      const result = await coreFinanceiroService.getHistorico(familiaId);
      setMeses(result.meses);
    } catch {
      setErro('Erro ao carregar histórico. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMeses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const handleGerarSnapshot = async (mesReferencia: string) => {
    setSnapshotLoading(mesReferencia);
    try {
      await coreFinanceiroService.gerarSnapshot(familiaId, mesReferencia);
      await loadMeses();
    } catch {
      setErro('Erro ao gerar snapshot. Tente novamente.');
    } finally {
      setSnapshotLoading(null);
    }
  };

  const handleSelectMes = async (mes: string) => {
    setMesSelecionado(mes);
    setDetalheLoading(true);
    try {
      const result = await coreFinanceiroService.getHistoricoDetalhe(familiaId, mes);
      setDetalhe(result);
    } finally {
      setDetalheLoading(false);
    }
  };

  const mesesOrdenados = [...meses].reverse();
  const saldos = mesesOrdenados.map((m) => parseFloat(m.saldo));
  const receitas = mesesOrdenados.map((m) => parseFloat(m.totalReceitas));
  const despesas = mesesOrdenados.map((m) => parseFloat(m.totalDespesas));
  const labels = mesesOrdenados.map((m) => formatMes(m.mesReferencia).slice(0, 3));

  return (
    <div className="min-h-screen bg-bg text-text">
      <FirstTimeTour
        tourKey="historico"
        steps={[
          { title: 'Histórico', description: 'Veja um resumo financeiro de cada mês passado.' },
          {
            title: 'Snapshot',
            description: 'Meses fechados têm um snapshot que preserva os dados do período.',
          },
          {
            title: 'Divergente',
            description:
              'Se uma transação for editada após o fechamento, o mês fica marcado como divergente.',
          },
          {
            title: 'Tendência',
            description: 'O gráfico de tendência mostra a evolução ao longo do tempo.',
          },
        ]}
      />
      <ErrorBanner error={erro} />

      <div className="mx-auto max-w-2xl p-4">
        {/* Header mobile */}
        <div className="mb-6 flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg bg-surface px-3 py-1.5 text-sm text-text-muted hover:bg-surface/80"
          >
            Voltar
          </button>
          <h1 className="text-xl font-bold">Histórico</h1>
        </div>

        {loading && <p className="py-8 text-center text-text-muted">Carregando...</p>}

        {!loading && meses.length === 0 && (
          <p className="py-8 text-center text-text-muted">
            Nenhum histórico disponível ainda. Registre transações para ver os meses aqui.
          </p>
        )}

        {/* Gráfico de tendência */}
        {!loading && meses.length >= 2 && (
          <div className="mb-4 rounded-xl border border-border bg-panel p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-text-muted">Tendência</p>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs text-success">Receitas</p>
                <MiniChart data={receitas} height={48} color="#22C55E" labels={labels} />
              </div>
              <div>
                <p className="mb-1 text-xs text-danger">Despesas</p>
                <MiniChart data={despesas} height={48} color="#EF4444" labels={labels} />
              </div>
              <div>
                <p className="mb-1 text-xs text-primary">Saldo</p>
                <MiniChart data={saldos} height={48} color="#3B82F6" labels={labels} />
              </div>
            </div>
          </div>
        )}

        {/* Lista de meses — desktop como tabela */}
        {!loading && meses.length > 0 && (
          <>
            {/* Mobile: cards */}
            <div className="space-y-2 md:hidden">
              {meses.map((mes) => (
                <div
                  key={mes.mesReferencia}
                  className="rounded-xl border border-border bg-panel p-4 transition-colors hover:bg-surface/50"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectMes(mes.mesReferencia)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">
                          {formatMes(mes.mesReferencia)}
                        </span>
                        {mes.divergente && (
                          <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                            ⚠ divergente
                          </span>
                        )}
                        {mes.temSnapshot && !mes.divergente && (
                          <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                            fechado
                          </span>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-success">+{formatBRL(mes.totalReceitas)}</div>
                        <div className="text-danger">-{formatBRL(mes.totalDespesas)}</div>
                        <div
                          className={
                            parseFloat(mes.saldo) >= 0
                              ? 'font-semibold text-success'
                              : 'font-semibold text-danger'
                          }
                        >
                          {formatBRL(mes.saldo)}
                        </div>
                      </div>
                    </div>
                  </button>
                  {!mes.temSnapshot && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        aria-label="Gerar Snapshot"
                        onClick={() => void handleGerarSnapshot(mes.mesReferencia)}
                        disabled={snapshotLoading === mes.mesReferencia}
                        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/80 disabled:opacity-50"
                      >
                        {snapshotLoading === mes.mesReferencia ? 'Gerando...' : 'Gerar Snapshot'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="pb-2 pr-4 font-semibold">Mês</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Receitas</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Despesas</th>
                    <th className="pb-2 pr-4 text-right font-semibold">Saldo</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((mes) => (
                    <tr
                      key={mes.mesReferencia}
                      className="cursor-pointer border-b border-border/50 hover:bg-surface/50"
                      onClick={() => handleSelectMes(mes.mesReferencia)}
                    >
                      <td className="py-3 pr-4 font-medium capitalize">
                        {formatMes(mes.mesReferencia)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-success">
                        +{formatBRL(mes.totalReceitas)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-danger">
                        -{formatBRL(mes.totalDespesas)}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-semibold tabular-nums ${parseFloat(mes.saldo) >= 0 ? 'text-success' : 'text-danger'}`}
                      >
                        {formatBRL(mes.saldo)}
                      </td>
                      <td className="py-3">
                        {mes.divergente ? (
                          <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                            ⚠ divergente
                          </span>
                        ) : mes.temSnapshot ? (
                          <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
                            fechado
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">
                            aberto
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {!mes.temSnapshot && (
                          <button
                            type="button"
                            aria-label="Gerar Snapshot"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleGerarSnapshot(mes.mesReferencia);
                            }}
                            disabled={snapshotLoading === mes.mesReferencia}
                            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/80 disabled:opacity-50"
                          >
                            {snapshotLoading === mes.mesReferencia
                              ? 'Gerando...'
                              : 'Gerar Snapshot'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Modal de detalhe */}
        {mesSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-panel p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold capitalize">
                  Detalhe — {formatMes(mesSelecionado)}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setMesSelecionado(null);
                    setDetalhe(null);
                  }}
                  className="text-text-muted hover:text-text"
                >
                  ✕
                </button>
              </div>

              {detalheLoading && <p className="text-text-muted">Carregando detalhe...</p>}

              {!detalheLoading && detalhe && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border p-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-text-muted">
                      Valores Atuais
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-text-muted">Receitas</p>
                        <p className="font-semibold text-success">
                          {formatBRL(detalhe.atual.totalReceitas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">Despesas</p>
                        <p className="font-semibold text-danger">
                          {formatBRL(detalhe.atual.totalDespesas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted">Saldo</p>
                        <p
                          className={`font-semibold ${parseFloat(detalhe.atual.saldo) >= 0 ? 'text-success' : 'text-danger'}`}
                        >
                          {formatBRL(detalhe.atual.saldo)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {detalhe.snapshot ? (
                    <div className="rounded-xl border border-border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-text-muted">
                          Snapshot (
                          {new Date(detalhe.snapshot.geradoEm).toLocaleDateString('pt-BR')})
                        </p>
                        {detalhe.snapshot.divergente && (
                          <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                            divergente
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                        <div>
                          <p className="text-text-muted">Receitas</p>
                          <p className="font-semibold text-success">
                            {formatBRL(detalhe.snapshot.totalReceitas)}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-muted">Despesas</p>
                          <p className="font-semibold text-danger">
                            {formatBRL(detalhe.snapshot.totalDespesas)}
                          </p>
                        </div>
                        <div>
                          <p className="text-text-muted">Saldo</p>
                          <p
                            className={`font-semibold ${parseFloat(detalhe.snapshot.saldo) >= 0 ? 'text-success' : 'text-danger'}`}
                          >
                            {formatBRL(detalhe.snapshot.saldo)}
                          </p>
                        </div>
                      </div>

                      {detalhe.snapshot.dadosCategorias.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold text-text-muted">
                            Por Categoria
                          </p>
                          <div className="space-y-1">
                            {detalhe.snapshot.dadosCategorias.map((cat) => (
                              <div key={cat.categoriaId} className="flex justify-between text-sm">
                                <span>{cat.categoriaNome}</span>
                                <span className="text-danger">{formatBRL(cat.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">Nenhum snapshot gerado para este mês.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
