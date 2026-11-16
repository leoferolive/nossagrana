import { useEffect, useState } from 'react';

import { CabecalhoDetalhe } from '@/components/cabecalho-detalhe';
import { IconConfiguracoes } from '@/components/icons';
import { LancamentosResumo } from '@/components/lancamentos-resumo';
import { TemplateGrupo } from '@/components/template-grupo';
import { MonthNav } from '@/components/month-nav';
import { TemplatesGerenciarModal } from '@/components/templates-gerenciar-modal';
import { CAMINHOS } from '@/routes/caminhos';
import { useTemplateTransacaoStore } from '@/stores/template-transacao.store';
import { shiftMonth } from '@/utils/date';
import { IconTemplates } from '../components/icons';

interface LancamentosPageProps {
  familiaId: string;
}

export function LancamentosPage({ familiaId }: LancamentosPageProps) {
  const templates = useTemplateTransacaoStore((s) => s.templates);
  const valores = useTemplateTransacaoStore((s) => s.valores);
  const mesReferencia = useTemplateTransacaoStore((s) => s.mesReferencia);
  const carregando = useTemplateTransacaoStore((s) => s.carregando);
  const salvando = useTemplateTransacaoStore((s) => s.salvando);
  const erro = useTemplateTransacaoStore((s) => s.erro);
  const fetchTemplates = useTemplateTransacaoStore((s) => s.fetchTemplates);
  const setValor = useTemplateTransacaoStore((s) => s.setValor);
  const setMesReferencia = useTemplateTransacaoStore((s) => s.setMesReferencia);
  const aplicar = useTemplateTransacaoStore((s) => s.aplicar);

  const [sucesso, setSucesso] = useState<{
    transacoesCriadas: number;
    aportesCriados: number;
  } | null>(null);
  const [gerenciarAberto, setGerenciarAberto] = useState(false);

  useEffect(() => {
    void fetchTemplates(familiaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const handleSalvar = async () => {
    setSucesso(null);
    try {
      const result = await aplicar(familiaId);
      setSucesso({
        transacoesCriadas: result.transacoesCriadas,
        aportesCriados: result.aportesCriados,
      });
    } catch {
      // error handled in store
    }
  };

  if (carregando) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  // Group templates
  const receitas = templates.filter((t) => t.tipo === 'receita' && !t.cofrinhoId);
  const cofrinhos = templates.filter((t) => t.cofrinhoId !== null);
  const despesas = templates.filter((t) => t.tipo === 'despesa' && !t.cofrinhoId);

  // Group despesas by categoriaNome
  const despesasPorCategoria = despesas.reduce<Record<string, typeof despesas>>((acc, t) => {
    const cat = t.categoriaNome ?? 'Sem categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <CabecalhoDetalhe
        titulo="Lançamentos do Mês"
        origem={CAMINHOS.planejar}
        acao={
          <button
            type="button"
            aria-label="Gerenciar templates"
            onClick={() => setGerenciarAberto(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition hover:text-text"
          >
            <IconConfiguracoes size={14} />
            Gerenciar
          </button>
        }
      />

      <TemplatesGerenciarModal
        open={gerenciarAberto}
        onClose={() => {
          setGerenciarAberto(false);
          void fetchTemplates(familiaId);
        }}
        familiaId={familiaId}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Os modelos valem também para o mês seguinte, então a seta para frente não trava no corrente. */}
        <div>
          <MonthNav
            mesReferencia={mesReferencia}
            onMesAnterior={() => setMesReferencia(shiftMonth(mesReferencia, -1))}
            onMesProximo={() => setMesReferencia(shiftMonth(mesReferencia, 1))}
            isCurrentMonth={false}
          />
        </div>

        {templates.length === 0 ? (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <IconTemplates size={48} aria-hidden="true" className="text-text-dim" />
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
              <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
                {erro}
              </p>
            )}

            {/* Success */}
            {sucesso && (
              <p className="rounded-lg border border-success/20 bg-accent-soft px-3 py-2 text-sm text-success">
                {sucesso.transacoesCriadas} transações e {sucesso.aportesCriados} aportes criados
                com sucesso!
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
