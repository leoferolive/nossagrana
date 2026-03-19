import type { ReactNode } from 'react';

import { BottomNav, type NavTab } from './bottom-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

type Screen = string;

interface AppShellProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onNovaTransacao: () => void;
  onLogout: () => void;
  children: ReactNode;
}

const mainTabs: NavTab[] = ['dashboard', 'extrato', 'relatorios', 'configuracoes'];

export const AppShell = ({
  currentScreen,
  onNavigate,
  onNovaTransacao,
  onLogout,
  children,
}: AppShellProps) => {
  const activeTab = (
    mainTabs.includes(currentScreen as NavTab) ? currentScreen : 'configuracoes'
  ) as NavTab;

  return (
    <div className="flex min-h-screen md:h-screen">
      {/* Sidebar: visível apenas no desktop */}
      <div className="hidden md:flex">
        <Sidebar currentScreen={currentScreen} onNavigate={onNavigate} onLogout={onLogout} />
      </div>

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar: visível apenas no desktop */}
        <div className="hidden md:block">
          <TopBar currentScreen={currentScreen} onNovaTransacao={onNovaTransacao} />
        </div>

        {/* Conteúdo — padding-bottom no mobile para não ficar atrás da BottomNav */}
        <main className="flex-1 overflow-y-auto pb-[68px] md:pb-0">{children}</main>

        {/* BottomNav: visível apenas no mobile */}
        <div className="md:hidden">
          <BottomNav active={activeTab} onNavigate={(tab) => onNavigate(tab)} />
        </div>
      </div>

      {/* Mobile FAB — acima da BottomNav */}
      <button
        type="button"
        aria-label="Nova transação"
        onClick={onNovaTransacao}
        className="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-white shadow-lg hover:bg-success-strong md:hidden"
      >
        +
      </button>
    </div>
  );
};
