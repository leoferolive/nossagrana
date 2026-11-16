import { ClipboardList, Ellipsis, House, Plus, Receipt, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useToqueLongo } from '../hooks/use-toque-longo';
import { CAMINHOS, type AbaDaBarra } from '../routes/caminhos';

import { ALVO_TOQUE_CLASSES } from './ui/campo-classes';

interface BottomNavProps {
  abaAtiva: AbaDaBarra;
  onLancar: () => void;
  onSegurarLancar?: () => void;
}

interface Aba {
  id: AbaDaBarra;
  icone: LucideIcon;
  rotulo: string;
  caminho: string;
}

const ABAS_DA_ESQUERDA: Aba[] = [
  { id: 'inicio', icone: House, rotulo: 'Início', caminho: CAMINHOS.inicio },
  { id: 'extrato', icone: Receipt, rotulo: 'Extrato', caminho: CAMINHOS.extrato },
];

const ABAS_DA_DIREITA: Aba[] = [
  { id: 'planejar', icone: ClipboardList, rotulo: 'Planejar', caminho: CAMINHOS.planejar },
  { id: 'mais', icone: Ellipsis, rotulo: 'Mais', caminho: CAMINHOS.mais },
];

const AbaDaBarraItem = ({ aba, ativa }: { aba: Aba; ativa: boolean }) => {
  const Icone = aba.icone;
  return (
    <Link
      to={aba.caminho}
      aria-current={ativa ? 'page' : undefined}
      className={`${ALVO_TOQUE_CLASSES} flex-col gap-0.5 text-[11px] transition-colors ${
        ativa ? 'font-bold text-success' : 'font-semibold text-text-dim'
      }`}
    >
      <Icone size={24} strokeWidth={ativa ? 2.5 : 1.75} aria-hidden="true" />
      <span>{aba.rotulo}</span>
    </Link>
  );
};

/**
 * O "+" mora na coluna do meio e sobe 28px acima da barra. Fica em `z-lancar`, abaixo dos
 * painéis: com o painel de lançar aberto ele não cobre os botões do painel.
 */
const BotaoLancar = ({
  onLancar,
  onSegurarLancar,
}: Pick<BottomNavProps, 'onLancar' | 'onSegurarLancar'>) => {
  const toque = useToqueLongo(onSegurarLancar);
  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        aria-label="Lançar"
        aria-description={onSegurarLancar ? 'Segure para lançar por voz' : undefined}
        {...toque.props}
        onClick={(e) => {
          if (toque.clique(e)) return;
          onLancar();
        }}
        className="absolute -top-7 z-lancar flex h-[58px] w-[58px] items-center justify-center rounded-full bg-success text-white ring-[6px] ring-bg hover:bg-success-strong"
      >
        <Plus size={28} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
};

export const BottomNav = ({ abaAtiva, onLancar, onSegurarLancar }: BottomNavProps) => (
  <nav
    aria-label="Navegação principal"
    className="fixed bottom-0 left-0 right-0 z-barra border-t border-border bg-panel pb-safe"
  >
    <div className="grid h-[84px] grid-cols-5 items-center">
      {ABAS_DA_ESQUERDA.map((aba) => (
        <AbaDaBarraItem key={aba.id} aba={aba} ativa={abaAtiva === aba.id} />
      ))}
      <BotaoLancar onLancar={onLancar} onSegurarLancar={onSegurarLancar} />
      {ABAS_DA_DIREITA.map((aba) => (
        <AbaDaBarraItem key={aba.id} aba={aba} ativa={abaAtiva === aba.id} />
      ))}
    </div>
  </nav>
);
