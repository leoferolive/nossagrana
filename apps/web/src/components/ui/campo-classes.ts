/**
 * Classes de todo campo de texto, número, data e seleção. Fonte de 16px evita o
 * zoom automático do iPhone ao focar; 44px de altura é o alvo de toque mínimo.
 * `py-2` existe porque o preflight zera o padding do <textarea>; 24px de linha + 16 de padding + 2 de borda = 42, e o min-h-11 leva a 44.
 * Para mudar a largura use um modificador importante (`!w-24`), porque `w-full`
 * já vem aqui.
 */
export const CAMPO_CLASSES =
  'min-h-11 w-full py-2 rounded-[10px] border border-border-strong bg-surface px-3 text-base text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-success disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-text-muted';

/** Garante área de toque de 44x44 em botão que só tem ícone ou texto curto. */
export const ALVO_TOQUE_CLASSES = 'inline-flex min-h-11 min-w-11 items-center justify-center';
