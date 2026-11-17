import { formatBRLNumber } from '@/utils/formatting';
import type { ResumoDoPeriodo as Resumo } from '@/utils/extrato';

interface ColunaProps {
  rotulo: string;
  centavos: number;
  cor: string;
}

const Coluna = ({ rotulo, centavos, cor }: ColunaProps) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-xs font-semibold text-text-dim">{rotulo}</span>
    <span className={`text-lg font-extrabold tabular-nums ${cor}`}>
      {formatBRLNumber(centavos / 100)}
    </span>
  </div>
);

/** Cartão de três colunas com Entradas (verde), Saídas e Saldo (vermelho só se negativo). */
export const ResumoDoPeriodo = ({ resumo }: { resumo: Resumo }) => (
  <div
    role="group"
    aria-label="Resumo do período"
    className="mx-3.5 grid grid-cols-3 gap-2 rounded-[18px] bg-panel p-4 shadow-soft"
  >
    <Coluna rotulo="Entradas" centavos={resumo.entradasCentavos} cor="text-success" />
    <Coluna rotulo="Saídas" centavos={resumo.saidasCentavos} cor="text-text" />
    <Coluna
      rotulo="Saldo"
      centavos={resumo.saldoCentavos}
      cor={resumo.saldoCentavos < 0 ? 'text-danger' : 'text-text'}
    />
  </div>
);
