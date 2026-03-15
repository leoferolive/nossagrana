import {
  ArcElement,
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
import { Doughnut, Line } from 'react-chartjs-2';

import { ErrorBanner } from '../components/error-banner';
import { coreFinanceiroService } from '../services/core-financeiro.service';

import type {
  RelatorioDistribuicaoItem,
  RelatorioTendenciaMes,
  RelatorioPorUsuarioItem,
} from '@nossagrana/types';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
);

type Tab = 'distribuicao' | 'por-membro' | 'tendencias';

interface RelatoriosPageProps {
  familiaId: string;
  onBack: () => void;
}

const CHART_COLORS = ['#4ade80', '#60a5fa', '#f87171', '#facc15', '#a78bfa', '#fb923c'];

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const RelatoriosPage = ({ familiaId, onBack }: RelatoriosPageProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('distribuicao');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [distribuicao, setDistribuicao] = useState<RelatorioDistribuicaoItem[]>([]);
  const [porUsuario, setPorUsuario] = useState<RelatorioPorUsuarioItem[]>([]);
  const [tendencias, setTendencias] = useState<RelatorioTendenciaMes[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      coreFinanceiroService.getRelatorioDistribuicao(familiaId),
      coreFinanceiroService.getRelatorioPorUsuario(familiaId),
      coreFinanceiroService.getRelatorioTendencias(familiaId),
    ])
      .then(([dist, porUser, tend]) => {
        setDistribuicao(dist.distribuicao);
        setPorUsuario(porUser.porUsuario);
        setTendencias(tend.meses);
      })
      .catch(() => setErro('Erro ao carregar relatórios. Tente novamente.'))
      .finally(() => setLoading(false));
  }, [familiaId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const donutData = {
    labels: distribuicao.map((d) => d.categoriaNome),
    datasets: [
      {
        data: distribuicao.map((d) => parseFloat(d.total)),
        backgroundColor: CHART_COLORS,
        borderWidth: 0,
      },
    ],
  };

  const lineData = {
    labels: tendencias.map((m) => m.mesReferencia),
    datasets: [
      {
        label: 'Receitas',
        data: tendencias.map((m) => parseFloat(m.totalReceitas)),
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Despesas',
        data: tendencias.map((m) => parseFloat(m.totalDespesas)),
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Saldo',
        data: tendencias.map((m) => parseFloat(m.saldo)),
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'distribuicao', label: 'Distribuição' },
    { id: 'por-membro', label: 'Por Membro' },
    { id: 'tendencias', label: 'Tendências' },
  ];

  return (
    <div className="min-h-screen bg-bg p-4">
      <ErrorBanner error={erro} />
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="rounded-lg bg-surface px-3 py-2 text-sm text-text-muted hover:bg-surface-hover"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-text">Relatórios</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Distribuição Tab */}
      {activeTab === 'distribuicao' && (
        <div>
          {distribuicao.length > 0 ? (
            <>
              <div className="mx-auto mb-6 max-w-xs">
                <Doughnut data={donutData} />
              </div>
              <ul className="space-y-2">
                {distribuicao.map((item) => (
                  <li
                    key={item.categoriaId}
                    className="flex items-center justify-between rounded-lg bg-surface p-3"
                  >
                    <span className="text-text">{item.categoriaNome}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-text-muted">{item.percentual}%</span>
                      <span className="font-medium text-text">{formatBRL(item.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-center text-text-muted">Nenhum dado de distribuição disponível.</p>
          )}
        </div>
      )}

      {/* Por Membro Tab */}
      {activeTab === 'por-membro' && (
        <div>
          {porUsuario.length > 0 ? (
            <ul className="space-y-2">
              {porUsuario.map((item) => (
                <li
                  key={item.usuarioId}
                  className="flex items-center justify-between rounded-lg bg-surface p-3"
                >
                  <span className="text-text">{item.usuarioNome}</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-text-muted">{item.percentual}%</span>
                    <span className="font-medium text-text">{formatBRL(item.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-text-muted">Nenhum dado por membro disponível.</p>
          )}
        </div>
      )}

      {/* Tendências Tab */}
      {activeTab === 'tendencias' && (
        <div>
          <Line data={lineData} />
        </div>
      )}
    </div>
  );
};
