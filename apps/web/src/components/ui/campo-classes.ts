/**
 * Classes de todo campo de texto, número, data e seleção. Fonte de 16px evita o
 * zoom automático do iPhone ao focar; 44px de altura é o alvo de toque mínimo.
 * `py-2.5` existe porque o preflight zera o padding do <textarea>; num <input> de 44px não muda a altura.
 * Para mudar a largura use um modificador importante (`!w-24`), porque `w-full`
 * já vem aqui.
 */
export const CAMPO_CLASSES =
  'min-h-11 w-full py-2.5 rounded-[10px] border border-border-strong bg-surface px-3 text-base text-text placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-success disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-text-muted';

/** Garante área de toque de 44x44 em botão que só tem ícone ou texto curto. */
export const ALVO_TOQUE_CLASSES = 'inline-flex min-h-11 min-w-11 items-center justify-center';
