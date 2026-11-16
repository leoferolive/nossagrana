import { IconAdicionar } from './icons';

type Screen = string;

interface TopBarProps {
  currentScreen: Screen;
  onNovaTransacao: () => void;
}

// No desktop o título de cada aba vive aqui (o cabeçalho de aba esconde o dele). As telas de
// detalhe mostram o próprio título no cabeçalho de detalhe, então esta barra não o repete.
const TITULOS_DE_ABA: Record<string, string> = {
  dashboard: 'Início',
  extrato: 'Extrato',
  planejar: 'Planejar',
  mais: 'Mais',
};

export const TopBar = ({ currentScreen, onNovaTransacao }: TopBarProps) => (
  <header className="sticky top-0 z-barra flex items-center justify-between border-b border-border bg-bg px-8 py-3">
    {TITULOS_DE_ABA[currentScreen] ? (
      <h2 className="text-lg font-bold text-text">{TITULOS_DE_ABA[currentScreen]}</h2>
    ) : (
      <span />
    )}
    <button
      type="button"
      onClick={onNovaTransacao}
      className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success-strong"
    >
      <IconAdicionar size={16} aria-hidden="true" />
      Nova Transação
    </button>
  </header>
);
