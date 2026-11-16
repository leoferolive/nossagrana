import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { abaDoCaminho } from '../routes/caminhos';

import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

type Screen = string;

interface AppShellProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onNovaTransacao: () => void;
  onVoiceActivate?: () => void;
  onLogout: () => void;
  familiaNome?: string;
  children: ReactNode;
}

export const AppShell = ({
  currentScreen,
  onNavigate,
  onNovaTransacao,
  onVoiceActivate,
  onLogout,
  familiaNome,
  children,
}: AppShellProps) => {
  const { pathname } = useLocation();

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar: visível apenas no desktop */}
      <div className="hidden md:flex">
        <Sidebar
          currentScreen={currentScreen}
          onNavigate={onNavigate}
          onLogout={onLogout}
          familiaNome={familiaNome}
        />
      </div>

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TopBar: visível apenas no desktop */}
        <div className="hidden md:block">
          <TopBar currentScreen={currentScreen} onNovaTransacao={onNovaTransacao} />
        </div>

        {/* Conteúdo — padding-bottom no mobile para o último item rolar acima da BottomNav e do "+" (84px + 28px) */}
        <main className="flex-1 overflow-y-auto pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>

        {/* BottomNav: visível apenas no mobile; o "+" mora dentro dela */}
        <div className="md:hidden">
          <BottomNav
            abaAtiva={abaDoCaminho(pathname)}
            onLancar={onNovaTransacao}
            onSegurarLancar={onVoiceActivate}
          />
        </div>
      </div>
    </div>
  );
};
