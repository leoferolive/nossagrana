import { useState, useEffect } from 'react';

interface CofrinhoRetiradaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { valor: string; descricao?: string | null; voltarAoSaldo: boolean }) => void;
  cofrinhoNome: string;
  saldoAtual: string;
}

export const CofrinhoRetiradaModal = ({
  open,
  onClose,
  onSubmit,
  cofrinhoNome,
  saldoAtual,
}: CofrinhoRetiradaModalProps) => {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [voltarAoSaldo, setVoltarAoSaldo] = useState(true);

  useEffect(() => {
    if (!open) {
      setValor('');
      setDescricao('');
      setVoltarAoSaldo(true);
    }
  }, [open]);

  const saldoNum = parseFloat(saldoAtual) || 0;
  const valorNum = parseFloat(valor) || 0;
  const valorValido = valorNum > 0 && valorNum <= saldoNum;

  const handleSubmit = () => {
    if (!valorValido) return;
    onSubmit({
      valor,
      descricao: descricao.trim() || null,
      voltarAoSaldo,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-t-2xl bg-bg p-5 shadow-soft md:rounded-2xl md:border md:border-border">
        {/* Handle bar mobile */}
        <div className="mb-4 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">Retirada — {cofrinhoNome}</h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Saldo disponível */}
          <p className="text-xs text-text-muted">
            Saldo disponivel: <span className="font-semibold text-text">R$ {saldoAtual}</span>
          </p>

          {/* Valor */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Valor (R$) *</span>
            <input
              aria-label="Valor"
              type="number"
              min="0.01"
              step="0.01"
              max={saldoNum}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-warning/40"
            />
            {valor && valorNum > saldoNum && (
              <span className="text-xs text-danger">Valor excede o saldo disponivel.</span>
            )}
          </label>

          {/* Descrição */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Descricao (opcional)</span>
            <input
              aria-label="Descrição"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Comprei o presente"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
            />
          </label>

          {/* Toggle: voltar ao saldo / usar fora */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-text-muted mb-1">
              O que fazer com o valor?
            </legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="destino"
                checked={voltarAoSaldo}
                onChange={() => setVoltarAoSaldo(true)}
                className="accent-success"
              />
              <span className="text-sm text-text">Voltar ao saldo</span>
            </label>
            <p className="ml-6 text-xs text-text-muted">
              O valor retorna como receita no mes atual.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="destino"
                checked={!voltarAoSaldo}
                onChange={() => setVoltarAoSaldo(false)}
                className="accent-warning"
              />
              <span className="text-sm text-text">Usar fora do sistema</span>
            </label>
            <p className="ml-6 text-xs text-text-muted">
              O valor e removido do cofrinho sem impactar o saldo.
            </p>
          </fieldset>
        </div>

        {/* Ações */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            aria-label="Cancelar"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text-muted transition hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valorValido}
            className="flex-1 rounded-lg bg-warning py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Retirar
          </button>
        </div>
      </div>
    </div>
  );
};
