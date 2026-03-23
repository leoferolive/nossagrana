import { useState, useEffect } from 'react';

interface CofrinhoEncerrarModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (voltarAoSaldo: boolean) => void;
  cofrinhoNome: string;
  saldoAtual: string;
}

export const CofrinhoEncerrarModal = ({
  open,
  onClose,
  onConfirm,
  cofrinhoNome,
  saldoAtual,
}: CofrinhoEncerrarModalProps) => {
  const [voltarAoSaldo, setVoltarAoSaldo] = useState(true);

  useEffect(() => {
    if (!open) {
      setVoltarAoSaldo(true);
    }
  }, [open]);

  const saldoNum = parseFloat(saldoAtual) || 0;
  const temSaldo = saldoNum > 0;

  const handleConfirm = () => {
    onConfirm(temSaldo ? voltarAoSaldo : false);
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
          <h2 className="text-base font-bold text-text">Encerrar Cofrinho</h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        {temSaldo ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text">
              Este cofrinho tem <span className="font-semibold">R$ {saldoAtual}</span> de saldo.
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-semibold text-text-muted mb-1">
                O que fazer com o saldo?
              </legend>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="destino-encerrar"
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
                  name="destino-encerrar"
                  checked={!voltarAoSaldo}
                  onChange={() => setVoltarAoSaldo(false)}
                  className="accent-danger"
                />
                <span className="text-sm text-text">Descartar valor</span>
              </label>
              <p className="ml-6 text-xs text-text-muted">
                O valor e removido sem impactar o saldo.
              </p>
            </fieldset>
          </div>
        ) : (
          <p className="text-sm text-text">
            Deseja encerrar o cofrinho <span className="font-semibold">{cofrinhoNome}</span>?
          </p>
        )}

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
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {temSaldo ? 'Encerrar cofrinho' : 'Encerrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
