/**
 * Único dado de sessão que sobrevive ao reload: o id da família ativa. É um UUID não secreto
 * (o servidor valida a posse em toda requisição, `requireFamiliaScope`), então persistir não
 * amplia a superfície de ataque; o access token nunca passa por aqui (#117).
 */
const FAMILIA_ATIVA_KEY = 'nossagrana.familia-ativa';
/** Chave da sessão pré-#117 (access token + refresh token + família). Só é lida para migrar a família. */
const SESSAO_LEGADA_KEY = 'nossagrana.auth.session';

export const lerFamiliaAtiva = (): string | null => {
  try {
    return localStorage.getItem(FAMILIA_ATIVA_KEY) || null;
  } catch {
    return null;
  }
};

export const gravarFamiliaAtiva = (familiaId: string): void => {
  try {
    if (familiaId) localStorage.setItem(FAMILIA_ATIVA_KEY, familiaId);
    else localStorage.removeItem(FAMILIA_ATIVA_KEY);
  } catch {
    // Storage indisponível (modo privado): a família só não sobrevive ao reload.
  }
};

/**
 * Remove a sessão legada e devolve apenas o `familiaIdAtiva` dela. Os tokens gravados ali são
 * descartados sem serem lidos para fora desta função.
 */
export const migrarSessaoLegada = (): string | null => {
  try {
    const bruto = localStorage.getItem(SESSAO_LEGADA_KEY);
    if (bruto === null) return null;
    localStorage.removeItem(SESSAO_LEGADA_KEY);
    return extrairFamiliaLegada(bruto);
  } catch {
    return null;
  }
};

const extrairFamiliaLegada = (bruto: string): string | null => {
  try {
    const { familiaIdAtiva } = JSON.parse(bruto) as { familiaIdAtiva?: unknown };
    return typeof familiaIdAtiva === 'string' && familiaIdAtiva ? familiaIdAtiva : null;
  } catch {
    return null;
  }
};
