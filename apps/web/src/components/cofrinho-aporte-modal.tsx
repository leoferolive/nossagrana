import { useState, useEffect } from 'react';

interface CofrinhoAporteModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { valor: string; descricao?: string | null }) => void;
  cofrinhoNome: string;
}

export const CofrinhoAporteModal = ({
  open,
  onClose,
  onSubmit,
  cofrinhoNome,
}: CofrinhoAporteModalProps) => {
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (!open) {
      setValor('');
      setDescricao('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!valor || parseFloat(valor) <= 0) return;
    onSubmit({
      valor,
      descricao: descricao.trim() || null,
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
          <h2 className="text-base font-bold text-text">Aporte — {cofrinhoNome}</h2>
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
          {/* Valor */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Valor (R$) *</span>
            <input
              aria-label="Valor"
              type="number"
              min="0.01"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          {/* Descrição */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Descrição (opcional)</span>
            <input
              aria-label="Descrição"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Mesada de março"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
            />
          </label>

          {/* Info */}
          <p className="text-xs text-text-muted">Sera registrado como saida no mes atual.</p>
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
            disabled={!valor || parseFloat(valor) <= 0}
            className="flex-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Aportar
          </button>
        </div>
      </div>
    </div>
  );
};
