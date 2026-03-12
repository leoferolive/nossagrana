import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useAppStore } from '@/stores/app.store';
export const App = () => {
    const increment = useAppStore((state) => state.increment);
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    const today = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);
    return (_jsxs("main", { className: "mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10", children: [_jsxs("header", { className: "rounded-2xl bg-brand-700 p-6 text-slate-100 shadow-lg", children: [_jsx("p", { className: "text-sm uppercase tracking-wide", children: "NossaGrana" }), _jsx("h1", { className: "mt-2 text-3xl font-bold", children: "Setup inicial concluido" }), _jsx("p", { className: "mt-3 text-sm text-slate-200", children: today })] }), _jsxs("section", { className: "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900", children: "Ambiente pronto para fase 1" }), _jsx("p", { className: "mt-3 text-slate-600", children: "API base em Fastify + frontend React/Tailwind + pacote de tipos compartilhado." }), _jsxs("p", { className: "mt-4 text-sm text-slate-500", children: ["VITE_API_URL: ", apiUrl] }), _jsx("button", { type: "button", onClick: increment, className: "mt-5 rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition hover:bg-brand-700", children: "Testar Zustand" })] })] }));
};
