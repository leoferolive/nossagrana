import {
  ArrowLeftRight,
  BarChart2,
  CalendarDays,
  CreditCard,
  HelpCircle,
  House,
  LogOut,
  Receipt,
  Tag,
  Target,
  Users,
} from 'lucide-react';

type Screen = string;

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}

const navGroups = [
  {
    items: [
      { id: 'dashboard', icon: House, label: 'Dashboard' },
      { id: 'extrato', icon: Receipt, label: 'Extrato' },
      { id: 'relatorios', icon: BarChart2, label: 'Relatórios' },
      { id: 'historico', icon: CalendarDays, label: 'Histórico' },
    ],
  },
  {
    items: [
      { id: 'categorias', icon: Tag, label: 'Categorias' },
      { id: 'metodos-pagamento', icon: CreditCard, label: 'Cartões' },
      { id: 'orcamento', icon: Target, label: 'Orçamento' },
    ],
  },
  {
    items: [
      { id: 'family-settings', icon: Users, label: 'Família' },
      { id: 'familia-selector', icon: ArrowLeftRight, label: 'Alternar Família' },
      { id: 'ajuda', icon: HelpCircle, label: 'Ajuda' },
    ],
  },
];

export const Sidebar = ({ currentScreen, onNavigate, onLogout }: SidebarProps) => (
  <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
    <div className="border-b border-border px-5 py-4">
      <h1 className="text-lg font-extrabold tracking-tight text-success">NossaGrana</h1>
      <p className="mt-0.5 text-xs text-text-muted">Finanças da família</p>
    </div>

    <nav className="flex-1 overflow-y-auto py-2">
      {navGroups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'mt-1 border-t border-border pt-1' : ''}>
          {group.items.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              onClick={() => onNavigate(id)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                currentScreen === id
                  ? 'bg-success/10 font-bold text-success'
                  : 'text-text-muted hover:bg-surface hover:text-text'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>

    <div className="border-t border-border px-4 py-3">
      <button
        type="button"
        aria-label="Sair"
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
      >
        <LogOut size={16} />
        <span>Sair</span>
      </button>
    </div>
  </aside>
);
