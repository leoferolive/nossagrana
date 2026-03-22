import { useEffect } from 'react';

import { BudgetBar } from '../components/charts/budget-bar';
import { MiniChart } from '../components/charts/mini-chart';
import { PieChart } from '../components/charts/pie-chart';
import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { IconCofrinho } from '../components/icons';
import { useCofrinhoStore } from '../stores/cofrinho.store';
import { useDashboardStore } from '../stores/dashboard.store';

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DashboardPageProps {
  familiaId: string;
  onNovaTransacao?: () => void;
  onNavigate?: (screen: string) => void;
}

export const DashboardPage = ({ familiaId, onNovaTransacao, onNavigate }: DashboardPageProps) => {
  const { resumo, graficos, orcamento, loading, error, fetchAll } = useDashboardStore();
  const { cofrinhos, fetchAll: fetchCofrinhos } = useCofrinhoStore();

  useEffect(() => {
    fetchAll(familiaId);
    fetchCofrinhos(familiaId);
  }, [familiaId, fetchAll, fetchCofrinhos]);

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

  const pieData = (graficos?.distribuicaoCategorias ?? []).map((c) => ({
    label: c.categoriaNome,
    value: parseFloat(c.total),
  }));

  const miniChartData = (graficos?.evolucaoDiaria ?? []).map((d) => parseFloat(d.totalDespesas));
  const miniChartLabels = (graficos?.evolucaoDiaria ?? []).map((d) => d.dia.slice(8));

  const dashboardTourSteps = [
    {
      title: 'Bem-vindo ao NossaGrana!',
      description: 'Esta é a tela principal. Aqui você vê o resumo financeiro do mês.',
    },
    {
      title: 'Receitas e Despesas',
      description: 'Os cards mostram o total de receitas, despesas e saldo do mês atual.',
    },
    {
      title: 'Nova Transação',
      description: 'Toque no botão "+" para registrar uma nova receita ou despesa.',
    },
    {
      title: 'Navegar',
      description: 'Use o menu inferior para acessar Extrato, Relatórios e Configurações.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <ErrorBanner error={error} />
      <FirstTimeTour tourKey="dashboard" steps={dashboardTourSteps} />

      {/* Header mobile */}
      <header className="flex items-center justify-between border-b border-border px-4 py-4 md:hidden">
        <div>
          <h1 className="text-xl font-bold text-text">NossaGrana</h1>
          <p className="text-sm capitalize text-text-muted">{mesLabel}</p>
        </div>
        {onNovaTransacao && (
          <button
            type="button"
            onClick={onNovaTransacao}
            className="flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-semibold text-white shadow hover:bg-success-strong"
          >
            + Nova
          </button>
        )}
      </header>

      {/* Mês de referência no desktop */}
      {mesLabel && (
        <div className="hidden px-6 pt-4 md:block">
          <p className="text-sm capitalize text-text-muted">{mesLabel}</p>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* 3 cards de resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-semibold text-success">RECEITAS</p>
            <p className="mt-1 text-lg font-bold text-text">
              {formatBRL(resumo?.totalReceitas ?? '0')}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-semibold text-danger">DESPESAS</p>
            <p className="mt-1 text-lg font-bold text-text">
              {formatBRL(resumo?.totalDespesas ?? '0')}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="text-xs font-semibold text-primary">SALDO</p>
            <p className="mt-1 text-lg font-bold text-text">{formatBRL(resumo?.saldo ?? '0')}</p>
          </div>
        </div>

        {/* Distribuição por categoria — PieChart SVG */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <p className="mb-3 text-xs font-semibold text-text-muted">DESPESAS POR CATEGORIA</p>
          {pieData.length > 0 ? (
            <PieChart data={pieData} size={110} />
          ) : (
            <p className="text-center text-xs text-text-muted">Nenhuma transação registrada</p>
          )}
        </div>

        {/* Evolução do mês — MiniChart SVG */}
        {temTransacoes && miniChartData.length >= 2 && (
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="mb-2 text-xs font-semibold text-text-muted">EVOLUÇÃO DO MÊS</p>
            <MiniChart
              data={miniChartData}
              height={64}
              color="#EF4444"
              fill
              labels={miniChartLabels}
            />
          </div>
        )}

        {/* Orçamento — BudgetBar */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <p className="mb-3 text-xs font-semibold text-text-muted">ORÇAMENTO</p>
          {orcamento.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum orçamento configurado. Configure na tela de Orçamento.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {orcamento.map((item) => (
                <BudgetBar
                  key={item.categoriaId}
                  category={item.categoriaNome}
                  spent={parseFloat(item.totalGasto)}
                  limit={parseFloat(item.valorLimite)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Cofrinhos */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-text">
              <IconCofrinho className="h-4 w-4" /> Cofrinhos
            </h3>
            {cofrinhos.length > 0 && (
              <button
                onClick={() => onNavigate?.('cofrinhos')}
                className="text-sm text-success hover:underline"
              >
                Ver todos →
              </button>
            )}
          </div>
          {cofrinhos.length === 0 ? (
            <p className="text-sm text-text-muted">
              Sua família ainda não tem cofrinhos.
            </p>
          ) : (
            <div className="space-y-3">
              {cofrinhos.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{c.emoji || '🐷'}</span>
                    <span className="text-sm font-medium text-text">{c.nome}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(parseFloat(c.saldoAtual))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
