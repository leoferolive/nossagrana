/** Fechamento controlado: a família foi excluída (handshake e sockets já abertos). */
export const WS_CLOSE_FAMILIA_EXCLUIDA = 4004;

/**
 * Fechamento controlado: todas as sessões do usuário foram revogadas (troca/reset
 * de senha, #119). No handshake, também recusa token emitido antes da revogação.
 * O cliente não deve reconectar: só um novo login destrava.
 */
export const WS_CLOSE_SESSAO_REVOGADA = 4005;

/** Fechamento controlado: o usuário deixou de ser membro da família (#119). */
export const WS_CLOSE_MEMBRO_REMOVIDO = 4006;

/** Falha interna ao validar o acesso do handshake (falha fechada: o socket não fica conectado). */
export const WS_CLOSE_ERRO_INTERNO = 1011;
