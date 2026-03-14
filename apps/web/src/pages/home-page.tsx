interface HomePageProps {
  familiaId: string;
  onGoExtrato: () => void;
  onGoCategorias: () => void;
  onGoMetodos: () => void;
  onNovaTransacao: () => void;
}

export const HomePage = ({
  onGoExtrato,
  onGoCategorias,
  onGoMetodos,
  onNovaTransacao,
}: HomePageProps) => (
  <div className="flex min-h-screen flex-col bg-bg">
    <header className="border-b border-border px-4 py-4">
      <h1 className="text-xl font-bold text-text">NossaGrana</h1>
      <p className="text-sm text-text-muted">Gestão financeira familiar</p>
    </header>

    <main className="flex flex-1 flex-col gap-3 p-4">
      <button
        type="button"
        aria-label="Extrato"
        onClick={onGoExtrato}
        className="flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-4 text-left transition hover:bg-surface"
      >
        <span className="text-2xl">📋</span>
        <div>
          <p className="font-semibold text-text">Extrato</p>
          <p className="text-xs text-text-muted">Veja suas transações</p>
        </div>
      </button>

      <button
        type="button"
        aria-label="Categorias"
        onClick={onGoCategorias}
        className="flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-4 text-left transition hover:bg-surface"
      >
        <span className="text-2xl">🏷️</span>
        <div>
          <p className="font-semibold text-text">Categorias</p>
          <p className="text-xs text-text-muted">Organize seus gastos</p>
        </div>
      </button>

      <button
        type="button"
        aria-label="Cartões"
        onClick={onGoMetodos}
        className="flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-4 text-left transition hover:bg-surface"
      >
        <span className="text-2xl">💳</span>
        <div>
          <p className="font-semibold text-text">Cartões e Métodos</p>
          <p className="text-xs text-text-muted">Gerencie formas de pagamento</p>
        </div>
      </button>
    </main>

    <button
      type="button"
      aria-label="Nova transação"
      onClick={onNovaTransacao}
      className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-white shadow-lg transition hover:bg-success-strong"
    >
      +
    </button>
  </div>
);
