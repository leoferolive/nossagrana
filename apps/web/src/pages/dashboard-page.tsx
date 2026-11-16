import { useEffect, useMemo, useState } from 'react';

import { BudgetBar } from '../components/charts/budget-bar';
import { COR_DESPESA } from '../components/charts/chart-colors';
import { MiniChart } from '../components/charts/mini-chart';
import { PieChart } from '../components/charts/pie-chart';
import { CabecalhoAba } from '../components/cabecalho-aba';
import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import {
  IconAdicionar,
  IconAvancar,
  IconBoasVindas,
  IconCofrinho,
  IconEntrada,
  IconOrcamento,
  IconRelatorio,
  IconSaida,
  IconSaldo,
} from '../components/icons';
import { CAMINHOS } from '../routes/caminhos';
import { useNavegacao } from '../routes/use-navegacao';
import { getCurrentMonth } from '../utils/date';
import { useCofrinhoStore } from '../stores/cofrinho.store';
import { useDashboardStore } from '../stores/dashboard.store';
import { formatBRL } from '../utils/formatting';

function calcVariacao(atual: string, anterior: string): number | null {
  const ant = parseFloat(anterior);
  if (ant === 0) return null;
  return ((parseFloat(atual) - ant) / Math.abs(ant)) * 100;
}

function TrendBadge({ variacao, invertColor }: { variacao: number | null; invertColor?: boolean }) {
  if (variacao === null) return null;
  const isUp = variacao >= 0;
  const Seta = isUp ? IconEntrada : IconSaida;
  // invertColor: for expenses, going up is bad (red) and going down is good (green)
  const colorClass = invertColor
    ? isUp
      ? 'text-danger'
      : 'text-success'
    : isUp
      ? 'text-success'
      : 'text-danger';
  return (
    <span
      role="img"
      aria-label={`${isUp ? 'subiu' : 'caiu'} ${Math.abs(variacao).toFixed(0)}%`}
      className={`ml-1 inline-flex items-center gap-0.5 text-[10px] font-semibold ${colorClass}`}
    >
      <Seta size={10} aria-hidden="true" />
      {Math.abs(variacao).toFixed(0)}%
    </span>
  );
}

interface DashboardPageProps {
  familiaId: string;
  onNovaTransacao?: () => void;
}

export const DashboardPage = ({ familiaId, onNovaTransacao }: DashboardPageProps) => {
  const { irParaCaminho } = useNavegacao();
  const { resumo, graficos, orcamento, loading, error, fetchAll } = useDashboardStore();
  const { cofrinhos, fetchAll: fetchCofrinhos } = useCofrinhoStore();
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth);

  useEffect(() => {
    fetchAll(familiaId, mesReferencia);
    fetchCofrinhos(familiaId);
  }, [familiaId, mesReferencia, fetchAll, fetchCofrinhos]);

  const pieData = useMemo(
    () =>
      (graficos?.distribuicaoCategorias ?? []).map((c) => ({
        label: c.categoriaNome,
        value: parseFloat(c.total),
      })),
    [graficos?.distribuicaoCategorias],
  );

  const miniChartData = useMemo(
    () => (graficos?.evolucaoDiaria ?? []).map((d) => parseFloat(d.totalDespesas)),
    [graficos?.evolucaoDiaria],
  );

  const miniChartLabels = useMemo(
    () => (graficos?.evolucaoDiaria ?? []).map((d) => d.dia.slice(8)),
    [graficos?.evolucaoDiaria],
  );

  // Tendência mês anterior
  const mesAnterior = resumo?.mesAnterior ?? null;
  const varReceitas = useMemo(
    () =>
      mesAnterior ? calcVariacao(resumo?.totalReceitas ?? '0', mesAnterior.totalReceitas) : null,
    [resumo?.totalReceitas, mesAnterior],
  );
  const varDespesas = useMemo(
    () =>
      mesAnterior ? calcVariacao(resumo?.totalDespesas ?? '0', mesAnterior.totalDespesas) : null,
    [resumo?.totalDespesas, mesAnterior],
  );
  const varSaldo = useMemo(
    () => (mesAnterior ? calcVariacao(resumo?.saldo ?? '0', mesAnterior.saldo) : null),
    [resumo?.saldo, mesAnterior],
  );

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const temTransacoes =
    resumo && (parseFloat(resumo.totalReceitas) > 0 || parseFloat(resumo.totalDespesas) > 0);

  const dashboardTourSteps = [
    {
      icon: IconBoasVindas,
      title: 'Bem-vindo ao NossaGrana!',
      description:
        'Aqui é o seu painel financeiro. Você vê receitas, despesas e saldo do mês de forma rápida.',
    },
    {
      icon: IconSaldo,
      title: 'Cards de resumo',
      description:
        'Os três cards no topo mostram o total de receitas, despesas e o saldo. As setas indicam se subiu ou caiu em relação ao mês anterior.',
    },
    {
      icon: IconAdicionar,
      title: 'Registrar transação',
      description:
        'Toque no botão "+" (mobile) ou "Nova Transação" (desktop) para registrar uma receita ou despesa.',
    },
    {
      icon: IconRelatorio,
      title: 'Gráficos e orçamento',
      description:
        'Acompanhe despesas por categoria, evolução diária e limites de orçamento — tudo nesta mesma tela.',
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <ErrorBanner error={error} />
      <FirstTimeTour tourKey="dashboard" steps={dashboardTourSteps} />

      <CabecalhoAba titulo="Início" mes={mesReferencia} onMesChange={setMesReferencia} />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Saldo em largura total para o valor não ser cortado em 390px; no desktop volta a 3 colunas */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="col-span-2 rounded-xl border-l-2 border-border-strong bg-panel p-3 shadow-sm shadow-black/20 md:order-3 md:col-span-1">
            <p className="text-xs font-semibold text-text-muted">
              Saldo
              <TrendBadge variacao={varSaldo} />
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text">
              {formatBRL(resumo?.saldo ?? '0')}
            </p>
          </div>
          <div className="rounded-xl border-l-2 border-success bg-panel p-3 shadow-sm shadow-black/20 md:order-1">
            <p className="text-xs font-semibold text-success">
              Receitas
              <TrendBadge variacao={varReceitas} />
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text">
              {formatBRL(resumo?.totalReceitas ?? '0')}
            </p>
          </div>
          <div className="rounded-xl border-l-2 border-border-strong bg-panel p-3 shadow-sm shadow-black/20 md:order-2">
            <p className="text-xs font-semibold text-text-muted">
              Despesas
              <TrendBadge variacao={varDespesas} invertColor />
            </p>
            <p className="mt-1 break-words text-lg font-bold tabular-nums text-text">
              {formatBRL(resumo?.totalDespesas ?? '0')}
            </p>
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
              height={80}
              color={COR_DESPESA}
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
              <button
                type="button"
                onClick={() => irParaCaminho(CAMINHOS.limites)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Configurar orçamento
              </button>
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

        {/* Cofrinhos */}
        <div className="rounded-xl border border-border bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-text">
              <IconCofrinho className="h-4 w-4" /> Cofrinhos
            </h3>
            {cofrinhos.length > 0 && (
              <button
                onClick={() => irParaCaminho(CAMINHOS.cofrinhos)}
                className="inline-flex items-center gap-1 text-sm text-success hover:underline"
              >
                Ver todos
                <IconAvancar size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          {cofrinhos.length === 0 ? (
            <p className="text-sm text-text-muted">Sua família ainda não tem cofrinhos.</p>
          ) : (
            <div className="space-y-3">
              {cofrinhos.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {c.emoji ? (
                      <span>{c.emoji}</span>
                    ) : (
                      <IconCofrinho size={16} aria-hidden="true" />
                    )}
                    <span className="text-sm font-medium text-text">{c.nome}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatBRL(c.saldoAtual)}
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
