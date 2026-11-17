import type { TransacaoListResponse } from '@nossagrana/types';

import { formatarComSinal, valorAssinadoCentavos } from '@/utils/extrato';

import { IconeCategoria } from './icone-categoria';

type Transacao = TransacaoListResponse['transacoes'][number];

interface LinhaDeLancamentoProps {
  transacao: Transacao;
  categoriaNome: string;
  /** Nome da forma de pagamento; `null` quando o lançamento não tem. */
  metodoNome: string | null;
  onAbrir: (transacao: Transacao) => void;
}

const parcelaDe = (t: Transacao): string | null =>
  t.parcelado && t.parcelaAtual != null && t.numeroParcelas != null
    ? `${t.parcelaAtual}/${t.numeroParcelas}`
    : null;

const metadadoDe = (t: Transacao, categoriaNome: string, metodoNome: string | null): string =>
  [categoriaNome, metodoNome, parcelaDe(t), t.recorrente ? 'Recorrente' : null]
    .filter((parte): parte is string => Boolean(parte))
    .join(' · ');

/**
 * Linha do Extrato: ícone da categoria, título, metadado e valor. A linha inteira é um botão
 * (mínimo de 52px, que vence a regra base de 44px) que abre a edição.
 */
export const LinhaDeLancamento = ({
  transacao,
  categoriaNome,
  metodoNome,
  onAbrir,
}: LinhaDeLancamentoProps) => {
  const titulo = transacao.descricao || categoriaNome;
  const valor = formatarComSinal(valorAssinadoCentavos(transacao));
  return (
    <li>
      <button
        type="button"
        aria-label={`${titulo}, ${valor}`}
        onClick={() => onAbrir(transacao)}
        className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-surface"
      >
        <IconeCategoria nome={categoriaNome} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-text">{titulo}</span>
          <span className="block truncate text-xs text-text-dim">
            {metadadoDe(transacao, categoriaNome, metodoNome)}
          </span>
        </span>
        <span
          className={`shrink-0 text-[15px] font-bold tabular-nums ${transacao.tipo === 'receita' ? 'text-success' : 'text-text'}`}
        >
          {valor}
        </span>
      </button>
    </li>
  );
};
