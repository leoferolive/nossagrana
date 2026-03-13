export const BrandMark = () => {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M3.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v2h-5.25a2.75 2.75 0 1 0 0 5.5h5.25v1a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-9Z" />
          <path d="M13 11.25a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
          <path d="M18.5 9.5h1.25A1.75 1.75 0 0 1 21.5 11v2A1.75 1.75 0 0 1 19.75 14.75H13a2.75 2.75 0 1 1 0-5.5h5.5Z" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          NossaGrana
        </p>
        <p className="text-xs text-text-dim">Financas familiares em tempo real</p>
      </div>
    </div>
  );
};
