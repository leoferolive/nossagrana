import type { ReactNode } from 'react';

import { BrandMark } from './brand-mark';

interface AuthShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  showBrand?: boolean;
}

export const AuthShell = ({
  title,
  subtitle,
  children,
  footer,
  showBrand = true,
}: AuthShellProps) => {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-success/15 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-info/15 blur-3xl" />
      </div>
      <section className="relative w-full max-w-md rounded-2xl border border-border/80 bg-panel/95 p-8 shadow-soft backdrop-blur-sm">
        {showBrand && <BrandMark />}
        {title && <h1 className="mt-6 text-2xl font-bold text-text">{title}</h1>}
        {subtitle && <p className="mt-2 text-sm text-text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>
      </section>
    </main>
  );
};
