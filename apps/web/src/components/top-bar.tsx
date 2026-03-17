type Screen = string;

interface TopBarProps {
  currentScreen: Screen;
  onNovaTransacao: () => void;
}

const screenTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  extrato: 'Extrato',
  relatorios: 'Relatórios',
  historico: 'Histórico',
  categorias: 'Categorias',
  'metodos-pagamento': 'Cartões e Métodos',
  orcamento: 'Orçamento',
  'family-settings': 'Família',
  ajuda: 'Ajuda / FAQ',
  configuracoes: 'Configurações',
  perfil: 'Perfil',
  fatura: 'Fatura',
};

export const TopBar = ({ currentScreen, onNovaTransacao }: TopBarProps) => (
  <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-8 py-3">
    <h2 className="text-lg font-bold text-text">{screenTitles[currentScreen] ?? 'NossaGrana'}</h2>
    <button
      type="button"
      onClick={onNovaTransacao}
      className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success-strong"
    >
      + Nova Transação
    </button>
  </header>
);
