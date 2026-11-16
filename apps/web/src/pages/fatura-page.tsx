import { useEffect, useState } from 'react';

import { CabecalhoDetalhe } from '../components/cabecalho-detalhe';
import { CAMINHOS } from '../routes/caminhos';
import { coreFinanceiroService } from '../services/core-financeiro.service';
import { formatBRL } from '../utils/formatting';

interface FaturaItem {
  id: string;
  descricao: string | null;
  valor: string;
  data: string;
  categoriaId: string;
  categoriaNome: string;
  usuarioNome: string;
  parcelaAtual: number | null;
  numeroParcelas: number | null;
}

interface FaturaData {
  metodoPagamentoId: string;
  mesReferencia: string;
  total: string;
  transacoes: FaturaItem[];
}

interface FaturaPageProps {
  familiaId: string;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  mesReferencia: string;
}

export function FaturaPage({
  familiaId,
  metodoPagamentoId,
  metodoPagamentoNome,
  mesReferencia,
}: FaturaPageProps) {
  const [fatura, setFatura] = useState<FaturaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    coreFinanceiroService
      .getFatura(familiaId, metodoPagamentoId, mesReferencia)
      .then((data) => {
        setFatura(data);
      })
      .catch(() => {
        setError('Erro ao carregar fatura.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [familiaId, metodoPagamentoId, mesReferencia]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg">
      <CabecalhoDetalhe
        titulo={`Fatura — ${metodoPagamentoNome}`}
        origem={CAMINHOS.planejar}
        subtitulo={mesReferencia}
      />
      <div className="p-4">
        {error && (
          <div className="mb-4 rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border bg-panel p-4">
          {error ? null : !fatura || fatura.transacoes.length === 0 ? (
            <p className="text-center text-sm text-text-muted">Nenhuma transação nesta fatura.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {fatura.transacoes.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between rounded-lg bg-surface p-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-text">{item.descricao ?? '—'}</span>
                    <span className="text-xs text-text-muted">{item.categoriaNome}</span>
                    <span className="text-xs text-text-muted">{item.usuarioNome}</span>
                    <span className="text-xs text-text-muted">{item.data}</span>
                    {item.parcelaAtual !== null && item.numeroParcelas !== null && (
                      <span className="text-xs text-primary">
                        Parcela {item.parcelaAtual}/{item.numeroParcelas}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-text">{formatBRL(item.valor)}</span>
                </li>
              ))}
            </ul>
          )}

          {fatura && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold text-text-muted">Total</span>
              <span className="text-base font-bold text-text">{formatBRL(fatura.total)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
