import { BarChart2, House, Receipt, Settings } from 'lucide-react';

export type NavTab = 'dashboard' | 'extrato' | 'relatorios' | 'configuracoes';

interface BottomNavProps {
  active: NavTab;
  onNavigate: (tab: NavTab) => void;
}

const tabs = [
  { id: 'dashboard' as NavTab, icon: House, label: 'Home', ariaLabel: 'Ver dashboard' },
  { id: 'extrato' as NavTab, icon: Receipt, label: 'Extrato', ariaLabel: 'Ver extrato' },
  { id: 'relatorios' as NavTab, icon: BarChart2, label: 'Relatórios', ariaLabel: 'Ver relatórios' },
  {
    id: 'configuracoes' as NavTab,
    icon: Settings,
    label: 'Config',
    ariaLabel: 'Ver configurações',
  },
];

export const BottomNav = ({ active, onNavigate }: BottomNavProps) => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-border bg-panel pb-safe pt-2">
    {tabs.map(({ id, icon: Icon, label, ariaLabel }) => (
      <button
        key={id}
        type="button"
        aria-label={ariaLabel}
        onClick={() => onNavigate(id)}
        className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${
          active === id ? 'text-success' : 'text-text-muted'
        }`}
      >
        <Icon size={22} strokeWidth={active === id ? 2.5 : 1.75} />
        <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      </button>
    ))}
  </nav>
);
