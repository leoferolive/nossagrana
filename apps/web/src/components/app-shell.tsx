import { useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';

import { BottomNav, type NavTab } from './bottom-nav';
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

const mainTabs: NavTab[] = ['dashboard', 'extrato', 'relatorios', 'configuracoes'];

export const AppShell = ({
  currentScreen,
  onNavigate,
  onNovaTransacao,
  onVoiceActivate,
  onLogout,
  familiaNome,
  children,
}: AppShellProps) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const activeTab = (
    mainTabs.includes(currentScreen as NavTab) ? currentScreen : 'configuracoes'
  ) as NavTab;

  const pressActiveRef = useRef(false);

  const handlePressStart = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!onVoiceActivate) return;
    // Prevent double-fire from both pointer and mouse events
    if (pressActiveRef.current) return;
    pressActiveRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const timer = setTimeout(() => {
      longPressRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      onVoiceActivate();
    }, 500);
    timerRef.current = timer;
    startPosRef.current = { x: startX, y: startY };
  };

  const handlePressEnd = () => {
    pressActiveRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePressMove = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!startPosRef.current || !timerRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="flex min-h-screen md:h-screen">
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
        aria-label={onVoiceActivate ? 'Nova transação. Segure para usar voz' : 'Nova transação'}
        onPointerDown={handlePressStart}
        onMouseDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onMouseUp={handlePressEnd}
        onPointerMove={handlePressMove}
        onMouseMove={handlePressMove}
        onClick={(e) => {
          if (longPressRef.current) {
            e.preventDefault();
            longPressRef.current = false;
            return;
          }
          onNovaTransacao();
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-white shadow-lg hover:bg-success-strong md:hidden"
      >
        +
      </button>
    </div>
  );
};
