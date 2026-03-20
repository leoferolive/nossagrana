import { useCallback, useEffect, useState } from 'react';

import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { IconOrcamento, IconRelatorio } from '../components/icons';
import { MonthNav, getCurrentMonth, shiftMonth } from '../components/month-nav';
import { BudgetBar } from '../components/charts/budget-bar';
import { MiniChart } from '../components/charts/mini-chart';
import { PieChart } from '../components/charts/pie-chart';
import { useDashboardStore } from '../stores/dashboard.store';

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function calcVariacao(atual: string, anterior: string): number | null {
  const ant = parseFloat(anterior);
  if (ant === 0) return null;
  return ((parseFloat(atual) - ant) / Math.abs(ant)) * 100;
}

function TrendBadge({ variacao, invertColor }: { variacao: number | null; invertColor?: boolean }) {
  if (variacao === null) return null;
  const isUp = variacao >= 0;
  const arrow = isUp ? '\u2191' : '\u2193';
  // invertColor: for expenses, going up is bad (red) and going down is good (green)
  const colorClass = invertColor
    ? isUp
      ? 'text-danger'
      : 'text-success'
    : isUp
      ? 'text-success'
      : 'text-danger';
  return (
    <span className={`ml-1 text-[10px] font-semibold ${colorClass}`}>
      {arrow} {Math.abs(variacao).toFixed(0)}%
    </span>
  );
}

interface DashboardPageProps {
  familiaId: string;
  onNovaTransacao?: () => void;
  onNavigate?: (screen: string) => void;
}

export const DashboardPage = ({ familiaId, onNovaTransacao, onNavigate }: DashboardPageProps) => {
  const { resumo, graficos, orcamento, loading, error, fetchAll } = useDashboardStore();
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth);

  useEffect(() => {
    fetchAll(familiaId, mesReferencia);
  }, [familiaId, mesReferencia, fetchAll]);

  const handleMesAnterior = useCallback(() => setMesReferencia((m) => shiftMonth(m, -1)), []);
  const handleMesProximo = useCallback(() => setMesReferencia((m) => shiftMonth(m, 1)), []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const temTransacoes =
    resumo && (parseFloat(resumo.totalReceitas) > 0 || parseFloat(resumo.totalDespesas) > 0);

  const isCurrentMonth = mesReferencia === getCurrentMonth();

  const pieData = (graficos?.distribuicaoCategorias ?? []).map((c) => ({
    label: c.categoriaNome,
    value: parseFloat(c.total),
  }));

  const miniChartData = (graficos?.evolucaoDiaria ?? []).map((d) => parseFloat(d.totalDespesas));
  const miniChartLabels = (graficos?.evolucaoDiaria ?? []).map((d) => d.dia.slice(8));

  // Tendência mês anterior
  const mesAnterior = resumo?.mesAnterior ?? null;
  const varReceitas = mesAnterior
    ? calcVariacao(resumo?.totalReceitas ?? '0', mesAnterior.totalReceitas)
    : null;
  const varDespesas = mesAnterior
    ? calcVariacao(resumo?.totalDespesas ?? '0', mesAnterior.totalDespesas)
    : null;
  const varSaldo = mesAnterior ? calcVariacao(resumo?.saldo ?? '0', mesAnterior.saldo) : null;

  const dashboardTourSteps = [
    {
      icon: '👋',
      title: 'Bem-vindo ao NossaGrana!',
      description:
        'Aqui é o seu painel financeiro. Você vê receitas, despesas e saldo do mês de forma rápida.',
    },
    {
      icon: '💰',
      title: 'Cards de resumo',
      description:
        'Os três cards no topo mostram o total de receitas, despesas e o saldo. As setas indicam se subiu ou caiu em relação ao mês anterior.',
    },
    {
      icon: '➕',
      title: 'Registrar transação',
      description:
        'Toque no botão "+" (mobile) ou "Nova Transação" (desktop) para registrar uma receita ou despesa.',
    },
    {
      icon: '📊',
      title: 'Gráficos e orçamento',
      description:
        'Acompanhe despesas por categoria, evolução diária e limites de orçamento — tudo nesta mesma tela.',
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
          <MonthNav
            mesReferencia={mesReferencia}
            onMesAnterior={handleMesAnterior}
            onMesProximo={handleMesProximo}
            isCurrentMonth={isCurrentMonth}
          />
        </div>
      </header>

      {/* Mês de referência no desktop */}
      <div className="hidden px-6 pt-4 md:block">
        <MonthNav
          mesReferencia={mesReferencia}
          onMesAnterior={handleMesAnterior}
          onMesProximo={handleMesProximo}
          isCurrentMonth={isCurrentMonth}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* 3 cards de resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border-l-2 border-success bg-panel p-3 shadow-sm shadow-black/20">
            <p className="text-xs font-semibold text-success">
              Receitas
              <TrendBadge variacao={varReceitas} />
            </p>
            <p className="mt-1 text-lg font-bold text-text">
              {formatBRL(resumo?.totalReceitas ?? '0')}
            </p>
          </div>
          <div className="rounded-xl border-l-2 border-danger bg-panel p-3 shadow-sm shadow-black/20">
            <p className="text-xs font-semibold text-danger">
              Despesas
              <TrendBadge variacao={varDespesas} invertColor />
            </p>
            <p className="mt-1 text-lg font-bold text-text">
              {formatBRL(resumo?.totalDespesas ?? '0')}
            </p>
          </div>
          <div className="rounded-xl border-l-2 border-primary bg-panel p-3 shadow-sm shadow-black/20">
            <p className="text-xs font-semibold text-primary">
              Saldo
              <TrendBadge variacao={varSaldo} />
            </p>
            <p className="mt-1 text-lg font-bold text-text">{formatBRL(resumo?.saldo ?? '0')}</p>
          </div>
        </div>

        {/* Distribuição por categoria — PieChart SVG */}
        <div className="rounded-xl bg-panel p-4 shadow-sm shadow-black/20">
          <p className="mb-3 text-xs font-semibold text-text-muted">Despesas por categoria</p>
          {pieData.length > 0 ? (
            <PieChart data={pieData} size={110} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <IconRelatorio className="text-text-dim" size={32} />
              <p className="text-sm text-text-muted">Nenhuma despesa registrada neste mês</p>
              {onNovaTransacao && (
                <button
                  type="button"
                  onClick={onNovaTransacao}
                  className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success-strong"
                >
                  Adicionar transação
                </button>
              )}
            </div>
          )}
        </div>

        {/* Evolução do mês — MiniChart SVG */}
        {temTransacoes && miniChartData.length >= 2 && (
          <div className="rounded-xl bg-panel p-4 shadow-sm shadow-black/20">
            <p className="mb-2 text-xs font-semibold text-text-muted">Evolução do mês</p>
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
        <div className="rounded-xl bg-panel p-4 shadow-sm shadow-black/20">
          <p className="mb-3 text-xs font-semibold text-text-muted">Orçamento</p>
          {orcamento.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <IconOrcamento className="text-text-dim" size={32} />
              <p className="text-sm text-text-muted">Nenhum orçamento configurado</p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('orcamento')}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Configurar orçamento
                </button>
              )}
            </div>
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
      </div>
    </div>
  );
};
