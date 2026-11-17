import { useState } from 'react';

import { ALVO_TOQUE_CLASSES } from '../ui/campo-classes';
import { IconFechar } from '../icons';

import { Chip, GrupoDeChips } from './chip';

interface OpcaoDeCategoria {
  id: string;
  nome: string;
}

interface ChipsDeCategoriaProps {
  tipo: 'receita' | 'despesa';
  /** As mais usadas do tipo (até seis), na ordem em que aparecem. */
  maisUsadas: OpcaoDeCategoria[];
  /** Todas as opções do tipo, inclusive a categoria inativa do lançamento em edição. */
  todas: OpcaoDeCategoria[];
  selecionadaId: string;
  onEscolher: (categoriaId: string) => void;
}

interface ListaCompletaProps {
  tipo: 'receita' | 'despesa';
  todas: OpcaoDeCategoria[];
  selecionadaId: string;
  onEscolher: (categoriaId: string) => void;
  onFechar: () => void;
}

const ListaCompleta = ({
  tipo,
  todas,
  selecionadaId,
  onEscolher,
  onFechar,
}: ListaCompletaProps) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Todas as categorias"
    className="fixed inset-0 z-painel flex items-end justify-center bg-black/60 md:items-center"
    onClick={(e) => {
      if (e.target === e.currentTarget) onFechar();
    }}
  >
    <div className="flex max-h-[80%] w-full max-w-[520px] flex-col rounded-t-[28px] bg-panel pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-[28px] md:pb-4">
      <div className="flex items-center justify-between px-5 pt-3">
        <h3 className="text-base font-bold text-text">Todas as categorias</h3>
        <button
          type="button"
          aria-label="Fechar lista de categorias"
          onClick={onFechar}
          className={`${ALVO_TOQUE_CLASSES} text-text-muted hover:text-text`}
        >
          <IconFechar size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto px-5 py-3">
        {todas.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma categoria de {tipo} cadastrada</p>
        )}
        {todas.map((c) => (
          <Chip key={c.id} selecionado={c.id === selecionadaId} onClick={() => onEscolher(c.id)}>
            {c.nome}
          </Chip>
        ))}
      </div>
    </div>
  </div>
);

/** Se a escolhida está fora das mais usadas (edição, voz), ela entra como um chip a mais. */
const comEscolhida = (
  maisUsadas: OpcaoDeCategoria[],
  todas: OpcaoDeCategoria[],
  selecionadaId: string,
): OpcaoDeCategoria[] => {
  if (!selecionadaId || maisUsadas.some((c) => c.id === selecionadaId)) return maisUsadas;
  const escolhida = todas.find((c) => c.id === selecionadaId);
  return escolhida ? [...maisUsadas, escolhida] : maisUsadas;
};

/** Categoria em chips: as mais usadas do tipo e "Todas", que abre a lista completa num painel. */
export const ChipsDeCategoria = ({
  tipo,
  maisUsadas,
  todas,
  selecionadaId,
  onEscolher,
}: ChipsDeCategoriaProps) => {
  const [listaAberta, setListaAberta] = useState(false);
  const escolher = (id: string) => {
    onEscolher(id);
    setListaAberta(false);
  };

  return (
    <>
      <GrupoDeChips titulo="Categoria">
        {comEscolhida(maisUsadas, todas, selecionadaId).map((c) => (
          <Chip key={c.id} selecionado={c.id === selecionadaId} onClick={() => onEscolher(c.id)}>
            {c.nome}
          </Chip>
        ))}
        <Chip aria-haspopup="dialog" onClick={() => setListaAberta(true)}>
          Todas
        </Chip>
      </GrupoDeChips>
      {listaAberta && (
        <ListaCompleta
          tipo={tipo}
          todas={todas}
          selecionadaId={selecionadaId}
          onEscolher={escolher}
          onFechar={() => setListaAberta(false)}
        />
      )}
    </>
  );
};
