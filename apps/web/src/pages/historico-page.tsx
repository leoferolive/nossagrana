import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

import type { HistoricoDetalheResponse, HistoricoMesItem } from '@nossagrana/types';

import { coreFinanceiroService } from '../services/core-financeiro.service';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface HistoricoPageProps {
  familiaId: string;
  onBack: () => void;
}

const MES_NOMES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
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
  const [detalhe, setDetalhe] = useState<HistoricoDetalheResponse | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await coreFinanceiroService.getHistorico(familiaId);
        setMeses(result.meses);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [familiaId]);

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

  return (
    <div className="min-h-screen bg-bg text-text p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-surface text-text-muted hover:bg-surface/80 text-sm"
          >
            Voltar
          </button>
          <h1 className="text-xl font-bold">Histórico</h1>
        </div>

        {loading && <p className="text-text-muted text-center py-8">Carregando...</p>}

        {!loading && meses.length === 0 && (
          <p className="text-text-muted text-center py-8">
            Nenhum histórico disponível ainda. Registre transações para ver os meses aqui.
          </p>
        )}

        {!loading && meses.length >= 2 && (
          <div className="rounded-xl border border-border bg-panel p-4 mb-4">
            <p className="mb-3 text-xs font-semibold text-text-muted uppercase">Tendência</p>
            <Line
              data={{
                labels: [...meses].reverse().map((m) => formatMes(m.mesReferencia)),
                datasets: [
                  {
                    label: 'Receitas',
                    data: [...meses].reverse().map((m) => parseFloat(m.totalReceitas)),
                    borderColor: 'rgb(34,197,94)',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    fill: false,
                    tension: 0.3,
                  },
                  {
                    label: 'Despesas',
                    data: [...meses].reverse().map((m) => parseFloat(m.totalDespesas)),
                    borderColor: 'rgb(239,68,68)',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    fill: false,
                    tension: 0.3,
                  },
                  {
                    label: 'Saldo',
                    data: [...meses].reverse().map((m) => parseFloat(m.saldo)),
                    borderColor: 'rgb(59,130,246)',
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: false,
                    tension: 0.3,
                  },
                ],
              }}
              options={{
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { ticks: { callback: (v) => `R$${Number(v).toLocaleString('pt-BR')}` } } },
                maintainAspectRatio: true,
              }}
            />
          </div>
        )}

        {!loading && meses.length > 0 && (
          <div className="space-y-2">
            {meses.map((mes) => (
              <button
                key={mes.mesReferencia}
                type="button"
                onClick={() => handleSelectMes(mes.mesReferencia)}
                className="w-full text-left rounded-xl border border-border bg-panel p-4 hover:bg-surface/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold capitalize">{formatMes(mes.mesReferencia)}</span>
                    {mes.divergente && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
                        divergente
                      </span>
                    )}
                    {mes.temSnapshot && !mes.divergente && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">
                        fechado
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-success">+{formatBRL(mes.totalReceitas)}</div>
                    <div className="text-danger">-{formatBRL(mes.totalDespesas)}</div>
                    <div className={parseFloat(mes.saldo) >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                      {formatBRL(mes.saldo)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Detalhe do mês */}
        {mesSelecionado && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-panel rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold capitalize">
                  Detalhe — {formatMes(mesSelecionado)}
                </h2>
                <button
                  type="button"
                  onClick={() => { setMesSelecionado(null); setDetalhe(null); }}
                  className="text-text-muted hover:text-text"
                >
                  ✕
                </button>
              </div>

              {detalheLoading && <p className="text-text-muted">Carregando detalhe...</p>}

              {!detalheLoading && detalhe && (
                <div className="space-y-4">
                  {/* Valores atuais */}
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs text-text-muted mb-2 font-semibold uppercase">Valores Atuais</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-text-muted">Receitas</p>
                        <p className="font-semibold text-success">{formatBRL(detalhe.atual.totalReceitas)}</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Despesas</p>
                        <p className="font-semibold text-danger">{formatBRL(detalhe.atual.totalDespesas)}</p>
                      </div>
                      <div>
                        <p className="text-text-muted">Saldo</p>
                        <p className={`font-semibold ${parseFloat(detalhe.atual.saldo) >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatBRL(detalhe.atual.saldo)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Snapshot */}
                  {detalhe.snapshot ? (
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-text-muted font-semibold uppercase">Snapshot ({new Date(detalhe.snapshot.geradoEm).toLocaleDateString('pt-BR')})</p>
                        {detalhe.snapshot.divergente && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">divergente</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                        <div>
                          <p className="text-text-muted">Receitas</p>
                          <p className="font-semibold text-success">{formatBRL(detalhe.snapshot.totalReceitas)}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Despesas</p>
                          <p className="font-semibold text-danger">{formatBRL(detalhe.snapshot.totalDespesas)}</p>
                        </div>
                        <div>
                          <p className="text-text-muted">Saldo</p>
                          <p className={`font-semibold ${parseFloat(detalhe.snapshot.saldo) >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatBRL(detalhe.snapshot.saldo)}
                          </p>
                        </div>
                      </div>

                      {detalhe.snapshot.dadosCategorias.length > 0 && (
                        <div>
                          <p className="text-xs text-text-muted font-semibold mb-2">Por Categoria</p>
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

                      {detalhe.snapshot.dadosUsuarios.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-text-muted font-semibold mb-2">Por Membro</p>
                          <div className="space-y-1">
                            {detalhe.snapshot.dadosUsuarios.map((usr) => (
                              <div key={usr.usuarioId} className="flex justify-between text-sm">
                                <span>{usr.usuarioNome}</span>
                                <span className="text-danger">{formatBRL(usr.total)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-text-muted text-sm">Nenhum snapshot gerado para este mês.</p>
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
