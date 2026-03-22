import { useEffect, useState } from 'react';

import { BudgetBar } from '../components/charts/budget-bar';
import { CofrinhoAporteModal } from '../components/cofrinho-aporte-modal';
import { CofrinhoEncerrarModal } from '../components/cofrinho-encerrar-modal';
import { CofrinhoModal } from '../components/cofrinho-modal';
import { CofrinhoRetiradaModal } from '../components/cofrinho-retirada-modal';
import { cofrinhoService } from '../services/cofrinho.service';
import { useCofrinhoStore } from '../stores/cofrinho.store';

interface CofrinhoDetalhePageProps {
  familiaId: string;
  cofrinhoId: string;
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

const formatBRL = (value: string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    parseFloat(value),
  );

type ModalAberto = 'aporte' | 'retirada' | 'encerrar' | 'editar' | null;

export function CofrinhoDetalhePage({
  familiaId,
  cofrinhoId,
  onBack,
  onNavigate: _onNavigate,
}: CofrinhoDetalhePageProps) {
  const { cofrinhoSelecionado, carregando, fetchDetalhe } = useCofrinhoStore();
  const [modalAberto, setModalAberto] = useState<ModalAberto>(null);

  useEffect(() => {
    void fetchDetalhe(familiaId, cofrinhoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId, cofrinhoId]);

  if (carregando || !cofrinhoSelecionado) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const { cofrinho, movimentacoes, aporteRecorrenteAtivo } = cofrinhoSelecionado;
  const saldo = parseFloat(cofrinho.saldoAtual);
  const meta = cofrinho.metaValor ? parseFloat(cofrinho.metaValor) : null;
  const isEncerrado = cofrinho.status === 'encerrado';

  const handleAporte = async (payload: { valor: string; descricao?: string | null }) => {
    await cofrinhoService.aportar(familiaId, cofrinhoId, payload);
    void fetchDetalhe(familiaId, cofrinhoId);
  };

  const handleRetirada = async (payload: {
    valor: string;
    descricao?: string | null;
    voltarAoSaldo: boolean;
  }) => {
    await cofrinhoService.retirar(familiaId, cofrinhoId, payload);
    void fetchDetalhe(familiaId, cofrinhoId);
  };

  const handleEncerrar = async (voltarAoSaldo: boolean) => {
    await cofrinhoService.encerrar(familiaId, cofrinhoId, { voltarAoSaldo });
    void fetchDetalhe(familiaId, cofrinhoId);
    onBack();
  };

  const handleEditar = async (payload: {
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }) => {
    await cofrinhoService.editar(familiaId, cofrinhoId, payload);
    void fetchDetalhe(familiaId, cofrinhoId);
  };

  const handleCancelarRecorrente = async () => {
    await cofrinhoService.cancelarAporteRecorrente(familiaId, cofrinhoId);
    void fetchDetalhe(familiaId, cofrinhoId);
  };

  const frequenciaLabel: Record<string, string> = {
    mensal: 'Mensal',
    semanal: 'Semanal',
    quinzenal: 'Quinzenal',
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Back button */}
      <div className="border-b border-border px-4 py-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="text-sm font-medium text-primary transition hover:opacity-80"
        >
          &larr; Voltar
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4">
        {/* Header: emoji + nome + saldo + meta */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {cofrinho.emoji && (
              <span className="text-3xl">{cofrinho.emoji}</span>
            )}
            <h1 className="text-xl font-bold text-text">{cofrinho.nome}</h1>
          </div>

          {cofrinho.descricao && (
            <p className="text-sm text-text-muted">{cofrinho.descricao}</p>
          )}

          <div className="text-2xl font-bold text-primary">
            {formatBRL(cofrinho.saldoAtual)}
          </div>

          {meta !== null && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-text-muted">
                Meta: {formatBRL(cofrinho.metaValor!)}
              </p>
              <BudgetBar
                category=""
                spent={saldo}
                limit={meta}
                compact
              />
            </div>
          )}

          {isEncerrado && (
            <span className="inline-flex w-fit items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
              Encerrado
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="Aportar"
            onClick={() => setModalAberto('aporte')}
            disabled={isEncerrado}
            className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Aportar
          </button>
          <button
            type="button"
            aria-label="Retirar"
            onClick={() => setModalAberto('retirada')}
            disabled={isEncerrado}
            className="rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Retirar
          </button>
          <button
            type="button"
            aria-label="Editar"
            onClick={() => setModalAberto('editar')}
            disabled={isEncerrado}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-hover disabled:opacity-50"
          >
            Editar
          </button>
          <button
            type="button"
            aria-label="Encerrar"
            onClick={() => setModalAberto('encerrar')}
            disabled={isEncerrado}
            className="rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50"
          >
            Encerrar
          </button>
        </div>

        {/* Aporte recorrente section */}
        {aporteRecorrenteAtivo && (
          <div className="rounded-xl border border-border bg-panel p-4">
            <h2 className="mb-2 text-sm font-bold text-text">Aporte recorrente</h2>
            <div className="flex flex-col gap-1 text-sm text-text-muted">
              <p>
                Valor: <span className="font-semibold text-text">{formatBRL(aporteRecorrenteAtivo.valor)}</span>
              </p>
              <p>
                Frequencia: <span className="font-semibold text-text">
                  {frequenciaLabel[aporteRecorrenteAtivo.frequencia] ?? aporteRecorrenteAtivo.frequencia}
                </span>
              </p>
              {aporteRecorrenteAtivo.dataFimRecorrencia && (
                <p>
                  Ate: <span className="font-semibold text-text">
                    {new Date(aporteRecorrenteAtivo.dataFimRecorrencia).toLocaleDateString('pt-BR')}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Cancelar recorrencia"
              onClick={() => void handleCancelarRecorrente()}
              className="mt-3 rounded-lg border border-danger px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/10"
            >
              Cancelar recorrencia
            </button>
          </div>
        )}

        {/* Movimentacoes list */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-text">
            Movimentacoes
          </h2>
          {movimentacoes.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhuma movimentacao registrada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {movimentacoes.map((mov) => {
                const isAporte = mov.tipo === 'aporte';
                return (
                  <div
                    key={mov.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-3"
                  >
                    <span
                      className={`text-lg font-bold ${isAporte ? 'text-success' : 'text-danger'}`}
                    >
                      {isAporte ? '\u2191' : '\u2193'}
                    </span>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold text-text">
                        {formatBRL(mov.valor)}
                      </span>
                      {mov.descricao && (
                        <span className="text-xs text-text-muted">{mov.descricao}</span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      {new Date(mov.registradoEm).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CofrinhoAporteModal
        open={modalAberto === 'aporte'}
        onClose={() => setModalAberto(null)}
        onSubmit={(payload) => void handleAporte(payload)}
        cofrinhoNome={cofrinho.nome}
      />

      <CofrinhoRetiradaModal
        open={modalAberto === 'retirada'}
        onClose={() => setModalAberto(null)}
        onSubmit={(payload) => void handleRetirada(payload)}
        cofrinhoNome={cofrinho.nome}
        saldoAtual={cofrinho.saldoAtual}
      />

      <CofrinhoModal
        open={modalAberto === 'editar'}
        onClose={() => setModalAberto(null)}
        onSubmit={(payload) => void handleEditar(payload)}
        editando={{
          nome: cofrinho.nome,
          emoji: cofrinho.emoji,
          descricao: cofrinho.descricao,
          metaValor: cofrinho.metaValor,
        }}
      />

      <CofrinhoEncerrarModal
        open={modalAberto === 'encerrar'}
        onClose={() => setModalAberto(null)}
        onConfirm={(voltarAoSaldo) => void handleEncerrar(voltarAoSaldo)}
        cofrinhoNome={cofrinho.nome}
        saldoAtual={cofrinho.saldoAtual}
      />
    </div>
  );
}
