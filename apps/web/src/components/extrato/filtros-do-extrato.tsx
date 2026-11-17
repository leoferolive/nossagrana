import { Ellipsis, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ALVO_TOQUE_CLASSES, CAMPO_CLASSES } from '../ui/campo-classes';

export type FiltroTipo = 'todos' | 'receita' | 'despesa';

interface FiltrosDoExtratoProps {
  filtro: FiltroTipo;
  onFiltro: (filtro: FiltroTipo) => void;
  busca: string;
  onBusca: (busca: string) => void;
  onExportar: () => void;
}

const CHIPS: ReadonlyArray<readonly [FiltroTipo, string]> = [
  ['todos', 'Tudo'],
  ['despesa', 'Saídas'],
  ['receita', 'Entradas'],
];

const BOTAO_ICONE = `${ALVO_TOQUE_CLASSES} rounded-full text-text-muted shadow-soft bg-panel hover:text-text`;

const Chip = ({
  rotulo,
  marcado,
  onClick,
}: {
  rotulo: string;
  marcado: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={marcado}
    onClick={onClick}
    className={`${ALVO_TOQUE_CLASSES} rounded-full px-3.5 text-sm transition ${
      marcado
        ? 'bg-success font-bold text-white'
        : 'bg-panel font-semibold text-text-muted ring-1 ring-border-strong hover:text-text'
    }`}
  >
    {rotulo}
  </button>
);

const MaisAcoes = ({ onExportar }: { onExportar: () => void }) => {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fecharFora);
    return () => document.removeEventListener('pointerdown', fecharFora);
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className={BOTAO_ICONE}
      >
        <Ellipsis size={20} aria-hidden="true" />
      </button>
      {aberto && (
        <div
          role="menu"
          onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
          className="absolute right-0 top-full z-painel mt-1 min-w-40 rounded-[14px] bg-panel p-1 shadow-soft"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAberto(false);
              onExportar();
            }}
            className="flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-semibold text-text hover:bg-surface"
          >
            Exportar CSV
          </button>
        </div>
      )}
    </div>
  );
};

/** Chips de tipo, botão de busca (abre o campo e dá foco) e menu "Mais ações" (Exportar CSV). */
export const FiltrosDoExtrato = ({
  filtro,
  onFiltro,
  busca,
  onBusca,
  onExportar,
}: FiltrosDoExtratoProps) => {
  const [buscando, setBuscando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (buscando) campo.current?.focus();
  }, [buscando]);

  const alternarBusca = () => {
    if (buscando) onBusca('');
    setBuscando((v) => !v);
  };

  return (
    <div className="px-3.5 pt-3">
      <div className="flex items-center gap-2">
        {CHIPS.map(([valor, rotulo]) => (
          <Chip
            key={valor}
            rotulo={rotulo}
            marcado={filtro === valor}
            onClick={() => onFiltro(valor)}
          />
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Buscar"
            aria-pressed={buscando}
            onClick={alternarBusca}
            className={BOTAO_ICONE}
          >
            <Search size={20} aria-hidden="true" />
          </button>
          <MaisAcoes onExportar={onExportar} />
        </div>
      </div>
      {buscando && (
        <input
          ref={campo}
          type="search"
          aria-label="Buscar por descrição"
          placeholder="Buscar por descrição..."
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          className={`${CAMPO_CLASSES} mt-3`}
        />
      )}
    </div>
  );
};
