import { Ellipsis, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { ALVO_TOQUE_CLASSES, CAMPO_CLASSES } from '../ui/campo-classes';

export type FiltroTipo = 'todos' | 'receita' | 'despesa';

interface FiltrosDoExtratoProps {
  filtro: FiltroTipo;
  onFiltro: (filtro: FiltroTipo) => void;
  /** `null` com a busca fechada; texto (possivelmente vazio) com ela aberta. Vive na página. */
  busca: string | null;
  onBusca: (busca: string | null) => void;
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
  const gatilho = useRef<HTMLButtonElement>(null);
  const primeiroItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    primeiroItem.current?.focus();
    const fecharFora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fecharFora);
    return () => document.removeEventListener('pointerdown', fecharFora);
  }, [aberto]);

  const fecharComFoco = () => {
    setAberto(false);
    gatilho.current?.focus();
  };

  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(e) => {
        if (aberto && e.key === 'Escape') fecharComFoco();
      }}
    >
      <button
        ref={gatilho}
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
          className="absolute right-0 top-full z-painel mt-1 min-w-40 rounded-[14px] bg-panel p-1 shadow-soft"
        >
          <button
            ref={primeiroItem}
            type="button"
            role="menuitem"
            onClick={() => {
              fecharComFoco();
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

interface CampoDeBuscaProps {
  texto: string;
  onTexto: (texto: string) => void;
  campo: RefObject<HTMLInputElement | null>;
}

const CampoDeBusca = ({ texto, onTexto, campo }: CampoDeBuscaProps) => (
  <div className="relative mt-3">
    <input
      ref={campo}
      type="search"
      aria-label="Buscar por descrição"
      placeholder="Buscar por descrição..."
      value={texto}
      onChange={(e) => onTexto(e.target.value)}
      className={`${CAMPO_CLASSES} pr-11 [&::-webkit-search-cancel-button]:appearance-none`}
    />
    {texto && (
      <button
        type="button"
        aria-label="Limpar busca"
        onClick={() => {
          onTexto('');
          campo.current?.focus();
        }}
        className={`${ALVO_TOQUE_CLASSES} absolute right-0 top-0 rounded-full text-text-muted hover:text-text`}
      >
        <X size={18} aria-hidden="true" />
      </button>
    )}
  </div>
);

/** Chips de tipo, botão de busca (abre o campo e dá foco) e menu "Mais ações" (Exportar CSV). */
export const FiltrosDoExtrato = ({
  filtro,
  onFiltro,
  busca,
  onBusca,
  onExportar,
}: FiltrosDoExtratoProps) => {
  const campo = useRef<HTMLInputElement>(null);
  const focarAoAbrir = useRef(false);
  const aberta = busca !== null;

  // Só o toque em "Buscar" dá foco; remontar com a busca já aberta não rouba o foco.
  useEffect(() => {
    if (aberta && focarAoAbrir.current) campo.current?.focus();
    focarAoAbrir.current = false;
  }, [aberta]);

  const alternarBusca = () => {
    focarAoAbrir.current = !aberta;
    onBusca(aberta ? null : '');
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
            aria-pressed={aberta}
            onClick={alternarBusca}
            className={BOTAO_ICONE}
          >
            <Search size={20} aria-hidden="true" />
          </button>
          <MaisAcoes onExportar={onExportar} />
        </div>
      </div>
      {aberta && <CampoDeBusca texto={busca} onTexto={onBusca} campo={campo} />}
    </div>
  );
};
