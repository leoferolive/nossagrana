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
import { useEffect } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';

import { FirstTimeTour } from '../components/first-time-tour';
import { useDashboardStore } from '../stores/dashboard.store';

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

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusColor: Record<string, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  exceeded: 'bg-danger',
};

interface DashboardPageProps {
  familiaId: string;
  onNovaTransacao: () => void;
  onGoToExtrato?: () => void;
  onGoToCategorias?: () => void;
  onGoToMetodosPagamento?: () => void;
  onGoToOrcamento?: () => void;
  onGoToRelatorios?: () => void;
  onGoToHistorico?: () => void;
  onGoToAjuda?: () => void;
  onGoToConfiguracoes?: () => void;
}

export const DashboardPage = ({
  familiaId,
  onNovaTransacao,
  onGoToExtrato,
  onGoToCategorias,
  onGoToMetodosPagamento,
  onGoToOrcamento,
  onGoToRelatorios,
  onGoToHistorico,
  onGoToAjuda,
  onGoToConfiguracoes,
}: DashboardPageProps) => {
  const { resumo, graficos, orcamento, loading, fetchAll } = useDashboardStore();

  useEffect(() => {
    fetchAll(familiaId);
  }, [familiaId, fetchAll]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const temTransacoes =
    resumo && (parseFloat(resumo.totalReceitas) > 0 || parseFloat(resumo.totalDespesas) > 0);

  const mesLabel = resumo?.mesReferencia
    ? new Date(`${resumo.mesReferencia}-01`).toLocaleString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const donutData = {
    labels: graficos?.distribuicaoCategorias.map((c) => c.categoriaNome) ?? [],
    datasets: [
      {
        data: graficos?.distribuicaoCategorias.map((c) => parseFloat(c.total)) ?? [],
        backgroundColor: ['#4ade80', '#60a5fa', '#f87171', '#facc15', '#a78bfa', '#fb923c'],
        borderWidth: 0,
      },
    ],
  };

  const lineData = {
    labels: graficos?.evolucaoDiaria.map((d) => d.dia.slice(8)) ?? [],
    datasets: [
      {
        label: 'Despesas',
        data: graficos?.evolucaoDiaria.map((d) => parseFloat(d.totalDespesas)) ?? [],
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Receitas',
        data: graficos?.evolucaoDiaria.map((d) => parseFloat(d.totalReceitas)) ?? [],
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const dashboardTourSteps = [
    { title: 'Bem-vindo ao NossaGrana!', description: 'Esta é a tela principal. Aqui você vê o resumo financeiro do mês.' },
    { title: 'Receitas e Despesas', description: 'Os cards mostram o total de receitas, despesas e saldo do mês atual.' },
    { title: 'Nova Transação', description: 'Toque no botão "+" para registrar uma nova receita ou despesa.' },
    { title: 'Navegar', description: 'Use o menu inferior para acessar Extrato, Orçamento, Relatórios, Histórico e Ajuda.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <FirstTimeTour tourKey="dashboard" steps={dashboardTourSteps} />
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text">NossaGrana</h1>
          <p className="text-sm capitalize text-text-muted">{mesLabel}</p>
        </div>
        <button
          type="button"
          onClick={onNovaTransacao}
          className="flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-semibold text-white shadow hover:bg-success-strong"
        >
          + Nova
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-border bg-panel p-3">
              <p className="text-xs font-semibold text-success">RECEITAS</p>
              <p className="text-lg font-bold text-text">
                {formatBRL(resumo?.totalReceitas ?? '0')}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-panel p-3">
              <p className="text-xs font-semibold text-danger">DESPESAS</p>
              <p className="text-lg font-bold text-text">
                {formatBRL(resumo?.totalDespesas ?? '0')}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-panel p-3">
              <p className="text-xs font-semibold text-primary">SALDO</p>
              <p className="text-lg font-bold text-text">{formatBRL(resumo?.saldo ?? '0')}</p>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-xl border border-border bg-panel p-3">
            {graficos && graficos.distribuicaoCategorias.length > 0 ? (
              <Doughnut
                data={donutData}
                options={{ plugins: { legend: { display: false } }, maintainAspectRatio: true }}
              />
            ) : (
              <p className="text-center text-xs text-text-muted">Nenhuma transação registrada</p>
            )}
          </div>
        </div>

        {temTransacoes && (
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="mb-2 text-xs font-semibold text-text-muted">EVOLUÇÃO DO MÊS</p>
            <Line
              data={lineData}
              options={{
                scales: { x: { ticks: { maxTicksLimit: 10 } } },
                plugins: { legend: { position: 'bottom' } },
                maintainAspectRatio: true,
              }}
            />
          </div>
        )}

        <div className="rounded-xl border border-border bg-panel p-3">
          <p className="mb-3 text-xs font-semibold text-text-muted">ORÇAMENTO</p>
          {orcamento.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum orçamento configurado. Configure na tela de Orçamento.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {orcamento.map((item) => (
                <div key={item.categoriaId}>
                  <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                    <span>{item.categoriaNome}</span>
                    <span>
                      <span>{item.percentual.toFixed(0)}%</span>
                      {' — '}
                      {formatBRL(item.totalGasto)}/{formatBRL(item.valorLimite)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface">
                    <div
                      className={`h-1.5 rounded-full ${statusColor[item.status]}`}
                      style={{ width: `${Math.min(item.percentual, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <nav className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {onGoToExtrato && (
          <button
            type="button"
            onClick={onGoToExtrato}
            aria-label="Ver extrato"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Extrato
          </button>
        )}
        {onGoToCategorias && (
          <button
            type="button"
            onClick={onGoToCategorias}
            aria-label="Ver categorias"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Categorias
          </button>
        )}
        {onGoToMetodosPagamento && (
          <button
            type="button"
            onClick={onGoToMetodosPagamento}
            aria-label="Ver métodos de pagamento"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Cartões
          </button>
        )}
        {onGoToOrcamento && (
          <button
            type="button"
            onClick={onGoToOrcamento}
            aria-label="Ver orçamentos"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Orçamento
          </button>
        )}
        {onGoToRelatorios && (
          <button
            type="button"
            onClick={onGoToRelatorios}
            aria-label="Ver relatórios"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Relatórios
          </button>
        )}
        {onGoToHistorico && (
          <button
            type="button"
            onClick={onGoToHistorico}
            aria-label="Ver histórico"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Histórico
          </button>
        )}
        {onGoToAjuda && (
          <button
            type="button"
            onClick={onGoToAjuda}
            aria-label="Ver ajuda"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Ajuda
          </button>
        )}
        {onGoToConfiguracoes && (
          <button
            type="button"
            onClick={onGoToConfiguracoes}
            aria-label="Ver configurações"
            className="flex-1 rounded-lg bg-surface py-2 text-sm font-medium text-text-muted hover:bg-surface-hover"
          >
            Configurações
          </button>
        )}
      </nav>

      <button
        type="button"
        aria-label="Nova transação"
        onClick={onNovaTransacao}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-white shadow-lg hover:bg-success-strong"
      >
        +
      </button>
    </div>
  );
};
