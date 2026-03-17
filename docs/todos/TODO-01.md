# TODO-01 — Layout & Navegação

**Status:** ✅ Concluído

## Escopo

- `AppShell`: layout flex, Sidebar (desktop) + BottomNav (mobile) + FAB (mobile) + TopBar (desktop)
- `BottomNav`: 4 tabs (Home/Extrato/Relatórios/Config), tab ativa em verde, ícone + label
- `Sidebar`: 220px, logo NossaGrana, itens de navegação com estado ativo, info do usuário no rodapé
- `TopBar`: header desktop com botão "Nova Transação"
- `FAB`: botão circular fixo bottom-right, mobile-only, abre modal de transação

## Resultado

Componentes implementados em `apps/web/src/components/`:

- `app-shell.tsx` — layout responsivo único (`hidden md:flex`, `md:hidden`)
- `bottom-nav.tsx` — 4 tabs mobile
- `sidebar.tsx` — navegação desktop completa
- `top-bar.tsx` — header desktop com botão Nova Transação
- FAB embutido no `app-shell.tsx` (fixo, `md:hidden`)
