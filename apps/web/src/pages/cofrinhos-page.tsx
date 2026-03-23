import { useEffect, useState } from 'react';

import { BudgetBar } from '../components/charts/budget-bar';
import { CofrinhoModal } from '../components/cofrinho-modal';
import { ErrorBanner } from '../components/error-banner';
import { FirstTimeTour } from '../components/first-time-tour';
import { cofrinhoService } from '../services/cofrinho.service';
import { useCofrinhoStore } from '../stores/cofrinho.store';

interface CofrinhosPageProps {
  familiaId: string;
  onNavigate: (screen: string) => void;
  onVerDetalhe: (cofrinhoId: string) => void;
}

const formatBRL = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value));

export function CofrinhosPage({
  familiaId,
  onNavigate: _onNavigate,
  onVerDetalhe,
}: CofrinhosPageProps) {
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
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const cofrinhosTourSteps = [
    {
      title: 'Bem-vindo aos Cofrinhos!',
      description: 'Aqui você cria reservas para guardar dinheiro da família.',
    },
    {
      title: 'Metas',
      description: 'Defina uma meta opcional para acompanhar o progresso de cada cofrinho.',
    },
    {
      title: 'Aportes',
      description: 'Faça aportes manuais ou configure aportes automáticos mensais.',
    },
    {
      title: 'Retiradas',
      description: 'Retire quando precisar — você escolhe se o valor volta ao saldo ou não.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <FirstTimeTour tourKey="cofrinhos" steps={cofrinhosTourSteps} />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-text">Cofrinhos</h1>
        {cofrinhos.length > 0 && (
          <button
            type="button"
            aria-label="Novo Cofrinho"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Novo Cofrinho
          </button>
        )}
      </header>

      <ErrorBanner error={erro} />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {cofrinhos.length === 0 ? (
          /* Empty State */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
            <div className="text-5xl">🐷</div>
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
                  onClick={() => onVerDetalhe(cofrinho.id)}
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
                    <span className="inline-flex w-fit items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
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
