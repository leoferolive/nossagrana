import { useCallback, useEffect, useState } from 'react';

import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { MonthNav, getCurrentMonth, shiftMonth } from '../components/month-nav';
import { MiniChart } from '../components/charts/mini-chart';
import { PieChart } from '../components/charts/pie-chart';
import { coreFinanceiroService } from '../services/core-financeiro.service';

import type {
  RelatorioDistribuicaoItem,
  RelatorioTendenciaMes,
  RelatorioPorUsuarioItem,
} from '@nossagrana/types';

type Tab = 'distribuicao' | 'por-membro' | 'tendencias';

interface RelatoriosPageProps {
  familiaId: string;
  onBack: () => void;
}

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const RelatoriosPage = ({ familiaId, onBack: _onBack }: RelatoriosPageProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('distribuicao');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth);

  const [distribuicao, setDistribuicao] = useState<RelatorioDistribuicaoItem[]>([]);
  const [porUsuario, setPorUsuario] = useState<RelatorioPorUsuarioItem[]>([]);
  const [tendencias, setTendencias] = useState<RelatorioTendenciaMes[]>([]);

  const handleMesAnterior = useCallback(() => setMesReferencia((m) => shiftMonth(m, -1)), []);
  const handleMesProximo = useCallback(() => setMesReferencia((m) => shiftMonth(m, 1)), []);
  const isCurrentMonth = mesReferencia === getCurrentMonth();

  // Fetch distribuição e porUsuario quando mês ou familiaId mudam
  useEffect(() => {
    setLoading(true);
    setErro(null);
    Promise.all([
      coreFinanceiroService.getRelatorioDistribuicao(familiaId, mesReferencia),
      coreFinanceiroService.getRelatorioPorUsuario(familiaId, mesReferencia),
    ])
      .then(([dist, porUser]) => {
        setDistribuicao(dist.distribuicao);
        setPorUsuario(porUser.porUsuario);
      })
      .catch(() => setErro('Erro ao carregar relatórios. Tente novamente.'))
      .finally(() => setLoading(false));
  }, [familiaId, mesReferencia]);

  // Tendências sempre carregam uma vez (últimos 6 meses, sem filtro de mês)
  useEffect(() => {
    coreFinanceiroService
      .getRelatorioTendencias(familiaId)
      .then((tend) => setTendencias(tend.meses))
      .catch(() => {
        /* tendências não críticas */
      });
  }, [familiaId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const pieData = distribuicao.map((d) => ({
    label: d.categoriaNome,
    value: parseFloat(d.total),
  }));

  const receitas = tendencias.map((m) => parseFloat(m.totalReceitas));
  const despesas = tendencias.map((m) => parseFloat(m.totalDespesas));
  const saldos = tendencias.map((m) => parseFloat(m.saldo));
  const tendLabels = tendencias.map((m) => m.mesReferencia.slice(5));

  const tabs: { id: Tab; label: string }[] = [
    { id: 'distribuicao', label: 'Distribuição' },
    { id: 'por-membro', label: 'Por Membro' },
    { id: 'tendencias', label: 'Tendências' },
  ];

  return (
    <div className="min-h-screen bg-bg p-4">
      <FirstTimeTour
        tourKey="relatorios"
        steps={[
          {
            icon: '📊',
            title: 'Relatórios',
            description:
              'Analise seus gastos de diferentes ângulos: distribuição por categoria, comparação entre membros e tendências ao longo dos meses.',
          },
          {
            icon: '🔄',
            title: 'Abas de visualização',
            description:
              'Alterne entre Distribuição, Por Membro e Tendências usando as abas no topo.',
          },
        ]}
      />
      <ErrorBanner error={erro} />

      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text md:hidden">Relatórios</h1>
        <MonthNav
          mesReferencia={mesReferencia}
          onMesAnterior={handleMesAnterior}
          onMesProximo={handleMesProximo}
          isCurrentMonth={isCurrentMonth}
        />
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
                ? 'border-b-2 border-success text-success'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Distribuição */}
      {activeTab === 'distribuicao' && (
        <div className="space-y-4">
          {pieData.length > 0 ? (
            <>
              <div className="rounded-xl border border-border bg-panel p-4">
                <PieChart data={pieData} size={120} />
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

      {/* Por Membro */}
      {activeTab === 'por-membro' && (
        <div>
          {porUsuario.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {porUsuario.map((item) => (
                <div key={item.usuarioId} className="rounded-xl border border-border bg-panel p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/20 text-sm font-bold text-success">
                      {item.usuarioNome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-text">{item.usuarioNome}</p>
                      <p className="text-xs text-text-muted">{item.percentual}% do total</p>
                    </div>
                    <p className="ml-auto font-bold text-danger tabular-nums">
                      {formatBRL(item.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted">Nenhum dado por membro disponível.</p>
          )}
        </div>
      )}

      {/* Tendências */}
      {activeTab === 'tendencias' && (
        <div className="space-y-4">
          {tendencias.length >= 2 ? (
            <>
              <div className="rounded-xl border border-border bg-panel p-4">
                <p className="mb-2 text-xs font-semibold text-success">Receitas</p>
                <MiniChart data={receitas} height={56} color="#22C55E" labels={tendLabels} />
              </div>
              <div className="rounded-xl border border-border bg-panel p-4">
                <p className="mb-2 text-xs font-semibold text-danger">Despesas</p>
                <MiniChart data={despesas} height={56} color="#EF4444" labels={tendLabels} />
              </div>
              <div className="rounded-xl border border-border bg-panel p-4">
                <p className="mb-2 text-xs font-semibold text-primary">Saldo</p>
                <MiniChart data={saldos} height={56} color="#3B82F6" labels={tendLabels} />
              </div>
            </>
          ) : (
            <p className="text-center text-text-muted">
              Registre transações em pelo menos 2 meses para ver tendências.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
