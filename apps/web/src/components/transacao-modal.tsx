import { useState } from 'react';

import type { TransacaoCreateRequest } from '@nossagrana/types';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { TooltipHelp } from './tooltip-help';

interface TransacaoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: TransacaoCreateRequest) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const TransacaoModal = ({ open, onClose, onSubmit }: TransacaoModalProps) => {
  const categorias = useCategoriaStore((s) => s.categorias);
  const metodos = useMetodoPagamentoStore((s) => s.metodos);

  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(today);
  const [metodoPagamentoId, setMetodoPagamentoId] = useState('');

  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(2);

  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState<'mensal' | 'semanal' | 'quinzenal'>('mensal');
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState('');

  const handleSubmit = () => {
    const payload: TransacaoCreateRequest = {
      tipo,
      valor,
      categoriaId,
      descricao: descricao || null,
      data,
      metodoPagamentoId: metodoPagamentoId || null,
      parcelado,
      numeroParcelas: parcelado ? numeroParcelas : null,
      recorrente,
      frequencia: recorrente ? frequencia : null,
      dataFimRecorrencia: recorrente && dataFimRecorrencia ? dataFimRecorrencia : null,
    };
    onSubmit(payload);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-panel p-5 shadow-soft sm:rounded-2xl">
        <h2 className="mb-4 text-base font-bold text-text">Nova transação</h2>

        {/* Tipo: receita / despesa */}
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            aria-label="Receita"
            onClick={() => setTipo('receita')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tipo === 'receita'
                ? 'bg-success text-white'
                : 'border border-border text-text-muted hover:text-text'
            }`}
          >
            Receita
          </button>
          <button
            type="button"
            aria-label="Despesa"
            onClick={() => setTipo('despesa')}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tipo === 'despesa'
                ? 'bg-danger text-white'
                : 'border border-border text-text-muted hover:text-text'
            }`}
          >
            Despesa
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Valor */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Valor</span>
            <input
              aria-label="Valor"
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-info/40"
            />
          </label>

          {/* Categoria */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Categoria</span>
            <select
              aria-label="Categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
            >
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          {/* Data */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Data</span>
            <input
              aria-label="Data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
            />
          </label>

          {/* Método de pagamento */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Método de pagamento</span>
            <select
              aria-label="Método de pagamento"
              value={metodoPagamentoId}
              onChange={(e) => setMetodoPagamentoId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
            >
              <option value="">Sem método</option>
              {metodos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>

          {/* Descrição */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Descrição (opcional)</span>
            <input
              aria-label="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Mercado do mês"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
            />
          </label>

          {/* Toggles: parcelado / recorrente */}
          <div className="flex gap-2 items-center">
            <TooltipHelp text="Parcelado divide o valor em N meses. Cada parcela aparece no mês correspondente do cartão." />
            <TooltipHelp text="Recorrente repete a transação automaticamente (mensal, quinzenal ou semanal) até a data de encerramento ou indefinidamente." />
            <button
              type="button"
              aria-label="Parcelado"
              onClick={() => {
                setParcelado(!parcelado);
                setRecorrente(false);
              }}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
                parcelado
                  ? 'border-info bg-info/10 text-info'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              Parcelado
            </button>
            <button
              type="button"
              aria-label="Recorrente"
              onClick={() => {
                setRecorrente(!recorrente);
                setParcelado(false);
              }}
              className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${
                recorrente
                  ? 'border-warning bg-warning/10 text-warning'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              Recorrente
            </button>
          </div>

          {/* Campos de parcelamento */}
          {parcelado && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Número de parcelas</span>
              <input
                aria-label="Parcelas"
                type="number"
                min={2}
                max={72}
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
              />
              {valor && numeroParcelas > 1 && (
                <span className="text-xs text-text-muted">
                  = {(parseFloat(valor) / numeroParcelas).toFixed(2)} por parcela
                </span>
              )}
            </label>
          )}

          {/* Campos de recorrência */}
          {recorrente && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Frequência</span>
                <select
                  aria-label="Frequência"
                  value={frequencia}
                  onChange={(e) => setFrequencia(e.target.value as typeof frequencia)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
                >
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Data fim (opcional)</span>
                <input
                  aria-label="Data fim recorrência"
                  type="date"
                  value={dataFimRecorrencia}
                  onChange={(e) => setDataFimRecorrencia(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none"
                />
              </label>
            </>
          )}
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
            className="flex-1 rounded-lg bg-success py-2.5 text-sm font-semibold text-white transition hover:bg-success-strong"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
