import { useMemo } from 'react';

import { useAppStore } from '@/stores/app.store';

export const App = () => {
  const increment = useAppStore((state) => state.increment);
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

  const today = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="rounded-2xl bg-brand-700 p-6 text-slate-100 shadow-lg">
        <p className="text-sm uppercase tracking-wide">NossaGrana</p>
        <h1 className="mt-2 text-3xl font-bold">Setup inicial concluido</h1>
        <p className="mt-3 text-sm text-slate-200">{today}</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Ambiente pronto para fase 1</h2>
        <p className="mt-3 text-slate-600">
          API base em Fastify + frontend React/Tailwind + pacote de tipos compartilhado.
        </p>
        <p className="mt-4 text-sm text-slate-500">VITE_API_URL: {apiUrl}</p>
        <button
          type="button"
          onClick={increment}
          className="mt-5 rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition hover:bg-brand-700"
        >
          Testar Zustand
        </button>
      </section>
    </main>
  );
};
