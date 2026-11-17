import { formatarComSinal } from '@/utils/extrato';

interface CabecalhoDoDiaProps {
  rotulo: string;
  totalCentavos: number;
}

/** Cabeçalho de dia (34px, 12/700 em caixa alta) com o total do dia à direita. */
export const CabecalhoDoDia = ({ rotulo, totalCentavos }: CabecalhoDoDiaProps) => (
  <div className="flex h-[34px] items-center justify-between px-5">
    <h2 className="text-xs font-bold uppercase text-text-dim">{rotulo}</h2>
    <span
      aria-label={`Total do dia: ${formatarComSinal(totalCentavos)}`}
      className={`text-xs font-bold tabular-nums ${totalCentavos > 0 ? 'text-success' : 'text-text-dim'}`}
    >
      {formatarComSinal(totalCentavos)}
    </span>
  </div>
);
