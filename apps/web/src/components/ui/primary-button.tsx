import type { ReactNode } from 'react';

interface PrimaryButtonProps {
  children: ReactNode;
  type?: 'button' | 'submit';
}

export const PrimaryButton = ({ children, type = 'button' }: PrimaryButtonProps) => {
  return (
    <button
      type={type}
      className="w-full rounded-lg bg-success px-4 py-2.5 font-semibold text-white transition hover:bg-success-strong focus:outline-none focus:ring-2 focus:ring-success/40"
    >
      {children}
    </button>
  );
};
