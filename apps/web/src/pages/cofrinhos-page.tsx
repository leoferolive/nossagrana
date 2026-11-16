import { useEffect, useState } from 'react';

import { BudgetBar } from '../components/charts/budget-bar';
import { CabecalhoDetalhe } from '../components/cabecalho-detalhe';
import { CofrinhoModal } from '../components/cofrinho-modal';
import { ErrorBanner } from '../components/error-banner';
import { CAMINHOS, caminhoDoCofrinho } from '../routes/caminhos';
import { useNavegacao } from '../routes/use-navegacao';
import { cofrinhoService } from '../services/cofrinho.service';
import { useCofrinhoStore } from '../stores/cofrinho.store';
import { formatBRL } from '../utils/formatting';
import { IconAdicionar, IconCofrinho } from '../components/icons';

interface CofrinhosPageProps {
  familiaId: string;
}

export function CofrinhosPage({ familiaId }: CofrinhosPageProps) {
  const { irParaCaminho } = useNavegacao();
  const { cofrinhos, carregando, erro, fetchAll } = useCofrinhoStore();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetchAll(familiaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const handleCreate = async (payload: {
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }) => {
    await cofrinhoService.criar(familiaId, payload);
    void fetchAll(familiaId);
    setModalOpen(false);
  };

  if (carregando) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <CabecalhoDetalhe
        titulo="Cofrinhos"
        origem={CAMINHOS.planejar}
        acao={
          cofrinhos.length > 0 && (
            <button
              type="button"
              aria-label="Novo Cofrinho"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <IconAdicionar size={16} aria-hidden="true" />
              Novo Cofrinho
            </button>
          )
        }
      />

      <ErrorBanner error={erro} />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {cofrinhos.length === 0 ? (
          /* Empty State */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <IconCofrinho size={48} aria-hidden="true" className="text-text-dim" />
            <p className="text-center text-sm text-text-muted">
              Sua família ainda não tem cofrinhos.
            </p>
            <button
              type="button"
              aria-label="Criar cofrinho"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Criar cofrinho
            </button>
          </div>
        ) : (
          /* Grid of cofrinho cards */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cofrinhos.map((cofrinho) => {
              const saldo = parseFloat(cofrinho.saldoAtual);
              const meta = cofrinho.metaValor ? parseFloat(cofrinho.metaValor) : null;
              const metaAtingida = meta !== null && saldo >= meta;

              return (
                <button
                  key={cofrinho.id}
                  type="button"
                  onClick={() => irParaCaminho(caminhoDoCofrinho(cofrinho.id))}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-panel p-4 text-left transition hover:border-primary/40 hover:shadow-soft"
                >
                  {/* Emoji + Nome */}
                  <div className="flex items-center gap-2">
                    {cofrinho.emoji && <span className="text-2xl">{cofrinho.emoji}</span>}
                    <span className="text-sm font-semibold text-text">{cofrinho.nome}</span>
                  </div>

                  {/* Saldo */}
                  <div className="text-lg font-bold text-primary">
                    {formatBRL(cofrinho.saldoAtual)}
                  </div>

                  {/* Progress bar (only if has meta) */}
                  {meta !== null && <BudgetBar category="" spent={saldo} limit={meta} compact />}

                  {/* Badge "Meta atingida!" */}
                  {metaAtingida && (
                    <span className="inline-flex w-fit items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                      Meta atingida!
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CofrinhoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(payload) => void handleCreate(payload)}
      />
    </div>
  );
}
