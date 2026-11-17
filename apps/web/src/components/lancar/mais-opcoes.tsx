import { ChevronDown } from 'lucide-react';

import type { CamposLancamento } from '@/hooks/use-formulario-lancamento';

import { IconExcluir, IconParcelas, IconRecorrente } from '../icons';
import { CustomSelect } from '../ui/custom-select';
import { CAMPO_CLASSES } from '../ui/campo-classes';

interface MaisOpcoesProps {
  aberto: boolean;
  onAlternar: () => void;
  campos: CamposLancamento;
  mudar: (parcial: Partial<CamposLancamento>) => void;
  editando: boolean;
  /** Parcelas só existem para a forma de pagamento de cartão de crédito. */
  ehCredito: boolean;
  /** Presente só na edição: mostra "Excluir lançamento". */
  onExcluir?: () => void;
}

const BOTAO_ALTERNAVEL =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border py-2 text-sm font-semibold transition';
const ATIVO = 'border-success bg-accent-soft text-success';
const INATIVO = 'border-border-strong text-text-muted hover:text-text';

const Parcelas = ({ campos, mudar }: Pick<MaisOpcoesProps, 'campos' | 'mudar'>) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs text-text-muted">Número de parcelas</span>
    <input
      aria-label="Parcelas"
      type="number"
      min={2}
      max={72}
      value={campos.numeroParcelas}
      onChange={(e) => mudar({ numeroParcelas: Number(e.target.value) })}
      className={CAMPO_CLASSES}
    />
    {campos.valor && campos.numeroParcelas > 1 && (
      <span className="text-xs text-text-muted">
        = {(parseFloat(campos.valor) / campos.numeroParcelas).toFixed(2)} por parcela
      </span>
    )}
  </label>
);

const Repeticao = ({ campos, mudar }: Pick<MaisOpcoesProps, 'campos' | 'mudar'>) => (
  <>
    <CustomSelect
      label="Frequência"
      aria-label="Frequência"
      options={[
        { value: 'mensal', label: 'Mensal' },
        { value: 'semanal', label: 'Semanal' },
        { value: 'quinzenal', label: 'Quinzenal' },
      ]}
      value={campos.frequencia}
      onChange={(v) => mudar({ frequencia: v as CamposLancamento['frequencia'] })}
    />
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">Data fim (opcional)</span>
      <input
        aria-label="Data fim recorrência"
        type="date"
        value={campos.dataFimRecorrencia}
        onChange={(e) => mudar({ dataFimRecorrencia: e.target.value })}
        className={CAMPO_CLASSES}
      />
    </label>
  </>
);

const Alternadores = ({
  campos,
  mudar,
  ehCredito,
}: Pick<MaisOpcoesProps, 'campos' | 'mudar' | 'ehCredito'>) => {
  const parcelado = campos.parcelado && ehCredito;
  return (
    <div className="flex items-center gap-2">
      {ehCredito && (
        <button
          type="button"
          aria-label="Parcelado"
          aria-pressed={parcelado}
          title="Parcelado divide o valor em N meses. Cada parcela aparece no mês correspondente do cartão."
          onClick={() => mudar({ parcelado: !parcelado, recorrente: false })}
          className={`${BOTAO_ALTERNAVEL} ${parcelado ? ATIVO : INATIVO}`}
        >
          <IconParcelas size={16} aria-hidden="true" />
          Parcelado
        </button>
      )}
      <button
        type="button"
        aria-label="Recorrente"
        aria-pressed={campos.recorrente}
        title="Recorrente repete a transação automaticamente (mensal, quinzenal ou semanal) até a data de encerramento ou indefinidamente."
        onClick={() => mudar({ recorrente: !campos.recorrente, parcelado: false })}
        className={`${BOTAO_ALTERNAVEL} ${campos.recorrente ? ATIVO : INATIVO}`}
      >
        <IconRecorrente size={16} aria-hidden="true" />
        Recorrente
      </button>
    </div>
  );
};

/**
 * "Descrição, parcelas e repetição": uma linha que expande a descrição, parcelas (só com cartão
 * de crédito), repetição e, na edição, "Excluir lançamento".
 */
export const MaisOpcoes = ({
  aberto,
  onAlternar,
  campos,
  mudar,
  editando,
  ehCredito,
  onExcluir,
}: MaisOpcoesProps) => (
  <div className="flex flex-col">
    <button
      type="button"
      aria-expanded={aberto}
      onClick={onAlternar}
      className="flex items-center justify-between rounded-[10px] py-2 text-left text-sm font-bold text-text"
    >
      Descrição, parcelas e repetição
      <ChevronDown
        size={18}
        aria-hidden="true"
        className={`text-text-dim transition-transform ${aberto ? 'rotate-180' : ''}`}
      />
    </button>
    {aberto && (
      <div className="flex flex-col gap-3 pt-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">Descrição (opcional)</span>
          <input
            aria-label="Descrição"
            value={campos.descricao}
            onChange={(e) => mudar({ descricao: e.target.value })}
            placeholder="Ex: Mercado do mês"
            className={CAMPO_CLASSES}
          />
        </label>
        {!editando && <Alternadores campos={campos} mudar={mudar} ehCredito={ehCredito} />}
        {!editando && campos.parcelado && ehCredito && <Parcelas campos={campos} mudar={mudar} />}
        {!editando && campos.recorrente && <Repeticao campos={campos} mudar={mudar} />}
        {editando && onExcluir && (
          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-danger/30 py-2 text-sm font-semibold text-danger transition hover:bg-danger-soft"
          >
            <IconExcluir size={16} aria-hidden="true" />
            Excluir lançamento
          </button>
        )}
      </div>
    )}
  </div>
);
