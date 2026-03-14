import { useEffect, useState } from 'react';

import { coreFinanceiroService } from '../services/core-financeiro.service';

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
  onBack: () => void;
}

export function FaturaPage({
  familiaId,
  metodoPagamentoId,
  metodoPagamentoNome,
  mesReferencia,
  onBack,
}: FaturaPageProps) {
  const [fatura, setFatura] = useState<FaturaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coreFinanceiroService
      .getFatura(familiaId, metodoPagamentoId, mesReferencia)
      .then((data) => {
        setFatura(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [familiaId, metodoPagamentoId, mesReferencia]);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      <button aria-label="Voltar" onClick={onBack}>
        ← Voltar
      </button>

      <h1>
        Fatura — {metodoPagamentoNome}
      </h1>
      <p>{mesReferencia}</p>

      {fatura && fatura.transacoes.length === 0 ? (
        <p>Nenhuma transação nesta fatura.</p>
      ) : (
        <ul>
          {fatura?.transacoes.map((item) => (
            <li key={item.id}>
              <span>{item.descricao ?? '—'}</span>
              <span>{item.valor}</span>
              <span>{item.categoriaId}</span>
              <span>{item.categoriaNome}</span>
              <span>{item.usuarioNome}</span>
              <span>{item.data}</span>
              {item.parcelaAtual !== null && item.numeroParcelas !== null && (
                <span>Parcela {item.parcelaAtual}/{item.numeroParcelas}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {fatura && (
        <div>
          <span>Total</span>
          <span>{fatura.total}</span>
        </div>
      )}
    </div>
  );
}
