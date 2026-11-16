/**
 * Chave do único tour do app. É nova de propósito: quem já viu os oito tours antigos
 * (`tour-dashboard`, `tour-extrato`...) não tem esta marca e vê o tour de boas-vindas uma vez,
 * porque a navegação mudou para todo mundo.
 */
export const TOUR_DE_BOAS_VINDAS = 'boas-vindas';

const PREFIXO = 'tour-';

/** O armazenamento pode estar bloqueado (janela privada, dados do site bloqueados): nunca lança. */
export const jaViuTour = (tourKey: string): boolean => {
  try {
    return localStorage.getItem(`${PREFIXO}${tourKey}`) === 'true';
  } catch {
    return false;
  }
};

export const marcarTourComoVisto = (tourKey: string): void => {
  try {
    localStorage.setItem(`${PREFIXO}${tourKey}`, 'true');
  } catch {
    // Sem armazenamento o tour volta no próximo acesso; é o menor dos males.
  }
};

/** Apaga a marca para o tour abrir de novo ("Rever tutorial", em Ajuda). */
export const reabrirTour = (tourKey: string): void => {
  try {
    localStorage.removeItem(`${PREFIXO}${tourKey}`);
  } catch {
    // Mesmo motivo de `marcarTourComoVisto`.
  }
};
