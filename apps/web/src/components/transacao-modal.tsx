import { useEffect, useState } from 'react';

import type { TransacaoCreateRequest } from '@nossagrana/types';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { categoriaService, metodoPagamentoService } from '@/services/core-financeiro.service';
import { IconParcelas, IconRecorrente } from './icons';
import { CustomSelect } from './ui/custom-select';

interface TransacaoModalProps {
  open: boolean;
  familiaId: string;
  onClose: () => void;
  onSubmit: (payload: TransacaoCreateRequest) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const TransacaoModal = ({ open, familiaId, onClose, onSubmit }: TransacaoModalProps) => {
  const categorias = useCategoriaStore((s) => s.categorias);
  const setCategorias = useCategoriaStore((s) => s.setCategorias);
  const metodos = useMetodoPagamentoStore((s) => s.metodos);
  const setMetodos = useMetodoPagamentoStore((s) => s.setMetodos);

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

  useEffect(() => {
    if (!open || !familiaId) return;
    if (categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => setCategorias(res.categorias))
        .catch(() => {});
    }
    if (metodos.length === 0) {
      metodoPagamentoService
        .listar(familiaId)
        .then((res) => setMetodos(res.metodosPagamento))
        .catch(() => {});
    }
  }, [open, familiaId, categorias.length, metodos.length, setCategorias, setMetodos]);

  useEffect(() => {
    if (!open) {
      setTipo('despesa');
      setValor('');
      setCategoriaId('');
      setDescricao('');
      setData(today);
      setMetodoPagamentoId('');
      setParcelado(false);
      setNumeroParcelas(2);
      setRecorrente(false);
      setFrequencia('mensal');
      setDataFimRecorrencia('');
    }
  }, [open]);

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Bottom-sheet mobile / modal centrado desktop */}
      <div className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-t-2xl bg-bg p-5 shadow-soft md:rounded-2xl md:border md:border-border">
        {/* Handle bar mobile */}
        <div className="mb-4 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-text">Nova Transação</h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        {/* Toggle Receita / Despesa */}
        <div className="mb-5 flex gap-2">
          <button
            type="button"
            aria-label="Receita"
            onClick={() => setTipo('receita')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              tipo === 'receita'
                ? 'bg-success text-white'
                : 'border border-border text-text-muted hover:text-text'
            }`}
          >
            ↑ Receita
          </button>
          <button
            type="button"
            aria-label="Despesa"
            onClick={() => setTipo('despesa')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              tipo === 'despesa'
                ? 'bg-danger text-white'
                : 'border border-border text-text-muted hover:text-text'
            }`}
          >
            ↓ Despesa
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
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          {/* Categoria */}
          <CustomSelect
            label="Categoria"
            aria-label="Categoria"
            placeholder="Selecione..."
            options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
            value={categoriaId}
            onChange={setCategoriaId}
          />

          {/* Descrição */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Descrição (opcional)</span>
            <input
              aria-label="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Mercado do mês"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
            />
          </label>

          {/* Data */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Data</span>
            <input
              aria-label="Data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
            />
          </label>

          {/* Método de pagamento */}
          <CustomSelect
            label="Método de pagamento"
            aria-label="Método de pagamento"
            placeholder="Sem método"
            options={[
              { value: '', label: 'Sem método' },
              ...metodos.map((m) => ({ value: m.id, label: m.nome })),
            ]}
            value={metodoPagamentoId}
            onChange={setMetodoPagamentoId}
          />

          {/* Toggles: parcelado / recorrente */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Parcelado"
              title="Parcelado divide o valor em N meses. Cada parcela aparece no mês correspondente do cartão."
              onClick={() => {
                setParcelado(!parcelado);
                setRecorrente(false);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                parcelado
                  ? 'border-info bg-info/10 text-info'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              <IconParcelas size={14} />
              Parcelado
            </button>
            <button
              type="button"
              aria-label="Recorrente"
              title="Recorrente repete a transação automaticamente (mensal, quinzenal ou semanal) até a data de encerramento ou indefinidamente."
              onClick={() => {
                setRecorrente(!recorrente);
                setParcelado(false);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                recorrente
                  ? 'border-warning bg-warning/10 text-warning'
                  : 'border-border text-text-muted hover:text-text'
              }`}
            >
              <IconRecorrente size={14} />
              Recorrente
            </button>
          </div>

          {/* Campos condicionais: parcelamento */}
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
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
              />
              {valor && numeroParcelas > 1 && (
                <span className="text-xs text-text-muted">
                  = {(parseFloat(valor) / numeroParcelas).toFixed(2)} por parcela
                </span>
              )}
            </label>
          )}

          {/* Campos condicionais: recorrência */}
          {recorrente && (
            <>
              <CustomSelect
                label="Frequência"
                aria-label="Frequência"
                options={[
                  { value: 'mensal', label: 'Mensal' },
                  { value: 'semanal', label: 'Semanal' },
                  { value: 'quinzenal', label: 'Quinzenal' },
                ]}
                value={frequencia}
                onChange={(v) => setFrequencia(v as typeof frequencia)}
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Data fim (opcional)</span>
                <input
                  aria-label="Data fim recorrência"
                  type="date"
                  value={dataFimRecorrencia}
                  onChange={(e) => setDataFimRecorrencia(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none"
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
            Salvar Transação
          </button>
        </div>
      </div>
    </div>
  );
};
