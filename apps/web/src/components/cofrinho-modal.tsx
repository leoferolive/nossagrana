import { useEffect, useState } from 'react';

interface CofrinhoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }) => void;
  editando?: {
    nome: string;
    emoji: string | null;
    descricao: string | null;
    metaValor: string | null;
  } | null;
}

export const CofrinhoModal = ({ open, onClose, onSubmit, editando }: CofrinhoModalProps) => {
  const [nome, setNome] = useState('');
  const [emoji, setEmoji] = useState('');
  const [metaValor, setMetaValor] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (open && editando) {
      setNome(editando.nome);
      setEmoji(editando.emoji ?? '');
      setMetaValor(editando.metaValor ?? '');
      setDescricao(editando.descricao ?? '');
    } else if (!open) {
      setNome('');
      setEmoji('');
      setMetaValor('');
      setDescricao('');
    }
  }, [open, editando]);

  const handleSubmit = () => {
    if (!nome.trim()) return;
    onSubmit({
      nome: nome.trim(),
      emoji: emoji.trim() || null,
      descricao: descricao.trim() || null,
      metaValor: metaValor || null,
    });
    onClose();
  };

  if (!open) return null;

  const isEditing = !!editando;

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
          <h2 className="text-base font-bold text-text">
            {isEditing ? 'Editar Cofrinho' : 'Novo Cofrinho'}
          </h2>
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
          {/* Nome */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Nome *</span>
            <input
              aria-label="Nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do cofrinho"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          {/* Emoji */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Emoji (opcional)</span>
            <input
              aria-label="Emoji"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 10))}
              placeholder="🐷"
              maxLength={10}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          {/* Meta */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Meta (R$) (opcional)</span>
            <input
              aria-label="Meta (R$)"
              type="number"
              min="0"
              step="0.01"
              value={metaValor}
              onChange={(e) => setMetaValor(e.target.value)}
              placeholder="0,00"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          {/* Descrição */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Descrição (opcional)</span>
            <textarea
              aria-label="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Para que serve esse cofrinho?"
              rows={3}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-success/40 resize-none"
            />
          </label>
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
            disabled={!nome.trim()}
            className="flex-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isEditing ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
};
