import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        sidebar: 'rgb(var(--color-sidebar) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
        'card-alt': 'rgb(var(--color-card-alt) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        'text-dim': 'rgb(var(--color-text-dim) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-strong': 'rgb(var(--color-success-strong) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',
        'danger-soft': 'rgb(var(--color-danger-soft) / <alpha-value>)',
        'warning-soft': 'rgb(var(--color-warning-soft) / <alpha-value>)',
        'warning-fill': 'rgb(var(--color-warning-fill) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        'border-soft': 'rgb(var(--color-border-soft) / <alpha-value>)',
      },
      // Faz `pb-safe` (usada na BottomNav) existir; sem `viewport-fit=cover` o valor é 0.
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
      fontFamily: {
        sans: ['Manrope Variable', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        // Sem sombra projetada: profundidade vem da troca de superfície mais um anel de 1px.
        soft: '0 0 0 1px rgb(var(--color-border))',
      },
    },
  },
  plugins: [],
};

export default config;
