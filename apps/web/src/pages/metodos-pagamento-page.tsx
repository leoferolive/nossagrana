import { useEffect, useState } from 'react';

import { metodoPagamentoService } from '@/services/core-financeiro.service';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';

import type { MetodoPagamentoCreateRequest } from '@nossagrana/types';

interface MetodosPagamentoPageProps {
  familiaId: string;
  onBack: () => void;
  onVerFatura?: (id: string, nome: string, mes: string) => void;
}

type TipoMetodo = 'credito' | 'debito' | 'pix' | 'dinheiro';

const TIPO_LABEL: Record<TipoMetodo, string> = {
  credito: 'credito',
  debito: 'debito',
  pix: 'pix',
  dinheiro: 'dinheiro',
};

const TIPO_COLOR: Record<TipoMetodo, string> = {
  credito: 'bg-info/10 text-info',
  debito: 'bg-warning/10 text-warning',
  pix: 'bg-success/10 text-success',
  dinheiro: 'bg-text-dim/10 text-text-muted',
};

const TIPO_ICON: Record<TipoMetodo, string> = {
  credito: '\uD83D\uDCB3',
  debito: '\uD83D\uDCB3',
  pix: '\u26A1',
  dinheiro: '\uD83D\uDCB5',
};

const TIPO_ICON_BG: Record<TipoMetodo, string> = {
  credito: 'bg-[#8B5CF620]',
  debito: 'bg-warning/10',
  pix: 'bg-[#06B6D420]',
  dinheiro: 'bg-success/10',
};

export const MetodosPagamentoPage = ({
  familiaId,
  onBack,
  onVerFatura,
}: MetodosPagamentoPageProps) => {
  const { metodos, carregando } = useMetodoPagamentoStore();
  const setMetodos = useMetodoPagamentoStore((s) => s.setMetodos);
  const addMetodo = useMetodoPagamentoStore((s) => s.addMetodo);
  const removeMetodo = useMetodoPagamentoStore((s) => s.removeMetodo);
  const setCarregando = useMetodoPagamentoStore((s) => s.setCarregando);

  const [formOpen, setFormOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoMetodo>('credito');
  const [dataFechamento, setDataFechamento] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');

  useEffect(() => {
    if (!familiaId) return;
    setCarregando(true);
    metodoPagamentoService
      .listar(familiaId)
      .then((res) => setMetodos(res.metodosPagamento))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [familiaId, setCarregando, setMetodos]);

  const handleCloseForm = () => {
    setFormOpen(false);
    setNome('');
    setTipo('credito');
    setDataFechamento('');
    setDataVencimento('');
  };

  const handleSave = async () => {
    setCarregando(true);
    try {
      const payload: MetodoPagamentoCreateRequest = {
        nome,
        tipo,
        dataFechamento: tipo === 'credito' && dataFechamento ? parseInt(dataFechamento) : null,
        dataVencimento: tipo === 'credito' && dataVencimento ? parseInt(dataVencimento) : null,
      };
      const res = await metodoPagamentoService.criar(payload, familiaId);
      addMetodo(res.metodoPagamento);
      handleCloseForm();
    } catch {
      // silencioso por ora
    } finally {
      setCarregando(false);
    }
  };

  const handleDesativar = async (id: string) => {
    try {
      await metodoPagamentoService.desativar(id, familiaId);
      removeMetodo(id);
    } catch {
      // silencioso por ora
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="text-text-muted transition hover:text-text"
        >
          ←
        </button>
        <h1 className="text-lg font-bold text-text">Cartões e Pagamentos</h1>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white transition hover:bg-success-strong"
        >
          Novo método
        </button>
      </header>

      {/* Formulário inline */}
      {formOpen && (
        <div className="border-b border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-text">Novo método de pagamento</p>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Nome</span>
              <input
                aria-label="Nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-info/40"
                placeholder="Ex: Nubank, Pix João"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Tipo</span>
              <select
                aria-label="Tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMetodo)}
                className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text focus:outline-none"
              >
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </label>
            {tipo === 'credito' && (
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-text-muted">Dia fechamento</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    aria-label="Dia de fechamento"
                    value={dataFechamento}
                    onChange={(e) => setDataFechamento(e.target.value)}
                    className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text focus:outline-none"
                    placeholder="15"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-text-muted">Dia vencimento</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    aria-label="Dia de vencimento"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text focus:outline-none"
                    placeholder="22"
                  />
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted transition hover:text-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex-1 rounded-lg bg-success py-2 text-sm font-semibold text-white transition hover:bg-success-strong"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 p-4">
        {carregando && <p className="text-center text-sm text-text-muted">Carregando...</p>}

        {!carregando && metodos.length === 0 && (
          <p className="text-center text-sm text-text-muted">
            Nenhum método cadastrado. Adicione o primeiro!
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {metodos.map((m) => (
            <div key={m.id} className="cursor-pointer rounded-xl border border-border bg-panel p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-bold text-text">{m.nome}</div>
                  <div className="mt-1 text-xs text-text-muted">
                    {m.tipo === 'credito' && m.dataFechamento != null
                      ? `Fecha dia ${m.dataFechamento}${m.dataVencimento != null ? ` · Vence dia ${m.dataVencimento}` : ''}`
                      : TIPO_LABEL[m.tipo].toUpperCase()}
                  </div>
                  {m.tipo !== 'credito' && (
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TIPO_COLOR[m.tipo]}`}
                    >
                      {TIPO_LABEL[m.tipo]}
                    </span>
                  )}
                </div>
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${TIPO_ICON_BG[m.tipo]}`}
                  aria-hidden="true"
                >
                  {TIPO_ICON[m.tipo]}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {m.tipo === 'credito' && onVerFatura && (
                  <button
                    type="button"
                    onClick={() => {
                      const mes = new Intl.DateTimeFormat('pt-BR', {
                        year: 'numeric',
                        month: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      })
                        .format(new Date())
                        .split('/')
                        .reverse()
                        .join('-');
                      onVerFatura(m.id, m.nome, mes);
                    }}
                    aria-label={`Ver fatura de ${m.nome}`}
                    className="rounded-lg px-3 py-1 text-xs text-info transition hover:bg-info/10"
                  >
                    Ver fatura
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleDesativar(m.id)}
                  aria-label={`Desativar ${m.nome}`}
                  className="rounded-lg px-3 py-1 text-xs text-danger transition hover:bg-danger/10"
                >
                  Desativar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Botão mobile "+ Novo Método" */}
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="mt-4 w-full py-3 text-center text-sm font-semibold text-success transition hover:text-success-strong md:hidden"
        >
          + Novo Método
        </button>
      </div>
    </div>
  );
};
