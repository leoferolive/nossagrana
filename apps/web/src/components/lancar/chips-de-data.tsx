import { useState } from 'react';

import { formatDataBR, getTodayLocalISO, somarDias } from '@/utils/date';

import { CAMPO_CLASSES } from '../ui/campo-classes';

import { Chip, GrupoDeChips } from './chip';

interface ChipsDeDataProps {
  /** Data do lançamento em AAAA-MM-DD. */
  data: string;
  onChange: (data: string) => void;
}

/**
 * Quando: Hoje (padrão), Ontem e "Outra data", que mostra o campo de data e o chip com a data
 * escolhida. Hoje e Ontem saem do dia local do aparelho, nunca da data UTC.
 */
export const ChipsDeData = ({ data, onChange }: ChipsDeDataProps) => {
  const hoje = getTodayLocalISO();
  const ontem = somarDias(hoje, -1);
  const [escolheuOutra, setEscolheuOutra] = useState(false);
  const outra = escolheuOutra || (data !== hoje && data !== ontem);

  const escolher = (nova: string) => {
    setEscolheuOutra(false);
    onChange(nova);
  };

  return (
    <GrupoDeChips titulo="Quando">
      <Chip selecionado={!outra && data === hoje} onClick={() => escolher(hoje)}>
        Hoje
      </Chip>
      <Chip selecionado={!outra && data === ontem} onClick={() => escolher(ontem)}>
        Ontem
      </Chip>
      <Chip selecionado={outra} onClick={() => setEscolheuOutra(true)}>
        {outra && data ? `Outra data · ${formatDataBR(data)}` : 'Outra data'}
      </Chip>
      {outra && (
        <input
          aria-label="Data"
          type="date"
          value={data}
          onChange={(e) => onChange(e.target.value)}
          className={CAMPO_CLASSES}
        />
      )}
    </GrupoDeChips>
  );
};
