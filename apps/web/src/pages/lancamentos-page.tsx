import { useEffect, useState } from 'react';

import { IconConfiguracoes } from '@/components/icons';
import { LancamentosResumo } from '@/components/lancamentos-resumo';
import { TemplateGrupo } from '@/components/template-grupo';
import { TemplatesGerenciarModal } from '@/components/templates-gerenciar-modal';
import { useTemplateTransacaoStore } from '@/stores/template-transacao.store';

interface LancamentosPageProps {
  familiaId: string;
  onNavigate: (screen: string) => void;
}

const MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

function formatMesLabel(mes: string): string {
  const [ano, mesNum] = mes.split('-');
  return `${MESES[parseInt(mesNum, 10) - 1]} ${ano}`;
}

function addMonths(mes: string, delta: number): string {
  const [ano, mesNum] = mes.split('-').map(Number);
  const date = new Date(ano, mesNum - 1 + delta, 1);
  const novoAno = date.getFullYear();
  const novoMes = String(date.getMonth() + 1).padStart(2, '0');
  return `${novoAno}-${novoMes}`;
}

export function LancamentosPage({ familiaId, onNavigate: _onNavigate }: LancamentosPageProps) {
  const {
    templates,
    valores,
    mesReferencia,
    carregando,
    salvando,
    erro,
    fetchTemplates,
    setValor,
    setMesReferencia,
    aplicar,
  } = useTemplateTransacaoStore();

  const [sucesso, setSucesso] = useState<{ transacoesCriadas: number; aportesCriados: number } | null>(null);
  const [gerenciarAberto, setGerenciarAberto] = useState(false);

  useEffect(() => {
    void fetchTemplates(familiaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const handleSalvar = async () => {
    setSucesso(null);
    try {
      const result = await aplicar(familiaId);
      setSucesso({ transacoesCriadas: result.transacoesCriadas, aportesCriados: result.aportesCriados });
    } catch {
      // error handled in store
    }
  };

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  // Group templates
  const receitas = templates.filter((t) => t.tipo === 'receita' && !t.cofrinhoId);
  const cofrinhos = templates.filter((t) => t.cofrinhoId !== null);
  const despesas = templates.filter((t) => t.tipo === 'despesa' && !t.cofrinhoId);

  // Group despesas by categoriaNome
  const despesasPorCategoria = despesas.reduce<Record<string, typeof despesas>>(
    (acc, t) => {
      const cat = t.categoriaNome ?? 'Sem categoria';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(t);
      return acc;
    },
    {},
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-text">Lançamentos do Mês</h1>
        <button
          type="button"
          aria-label="Gerenciar templates"
          onClick={() => setGerenciarAberto(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition hover:text-text"
        >
          <IconConfiguracoes size={14} />
          Gerenciar
        </button>
      </header>

      <TemplatesGerenciarModal
        open={gerenciarAberto}
        onClose={() => {
          setGerenciarAberto(false);
          void fetchTemplates(familiaId);
        }}
        familiaId={familiaId}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Month selector */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-4 py-3">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMesReferencia(addMonths(mesReferencia, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
          >
            ◀
          </button>
          <span className="text-sm font-semibold text-text">{formatMesLabel(mesReferencia)}</span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMesReferencia(addMonths(mesReferencia, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-surface hover:text-text"
          >
            ▶
          </button>
        </div>

        {templates.length === 0 ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <div className="text-5xl">📋</div>
            <p className="text-center text-sm text-text-muted">Nenhum template cadastrado.</p>
            <p className="text-center text-xs text-text-muted">
              Configure templates nas configurações para agilizar seus lançamentos mensais.
            </p>
          </div>
        ) : (
          <>
            {/* Receitas */}
            {receitas.length > 0 && (
              <TemplateGrupo
                titulo="Receitas"
                templates={receitas}
                valores={valores}
                onSetValor={setValor}
              />
            )}

            {/* Despesas por categoria */}
            {Object.entries(despesasPorCategoria).map(([categoria, items]) => (
              <TemplateGrupo
                key={categoria}
                titulo={categoria}
                templates={items}
                valores={valores}
                onSetValor={setValor}
              />
            ))}

            {/* Cofrinhos */}
            {cofrinhos.length > 0 && (
              <TemplateGrupo
                titulo="Cofrinhos"
                templates={cofrinhos}
                valores={valores}
                onSetValor={setValor}
              />
            )}

            {/* Summary */}
            <LancamentosResumo templates={templates} valores={valores} />

            {/* Error */}
            {erro && (
              <p className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                {erro}
              </p>
            )}

            {/* Success */}
            {sucesso && (
              <p className="rounded-lg border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
                {sucesso.transacoesCriadas} transações e {sucesso.aportesCriados} aportes criados com sucesso!
              </p>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={() => void handleSalvar()}
              disabled={salvando}
              className="rounded-lg bg-success px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar Lançamentos'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
