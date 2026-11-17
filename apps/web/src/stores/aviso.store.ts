import { create } from 'zustand';

const DURACAO_EM_MS = 6_000;

interface AvisoEntrada {
  mensagem: string;
  /** Presente só quando dá para desfazer o que o aviso anuncia; vira o botão "Desfazer". */
  desfazer?: () => Promise<void>;
  /** `erro` troca o verde pelo vermelho de alerta. */
  tom?: 'erro';
}

export interface Aviso extends AvisoEntrada {
  /** Muda a cada aviso, para a tela tratar um aviso novo como novo mesmo com o texto igual. */
  id: number;
}

interface AvisoState {
  aviso: Aviso | null;
  /** Mostra o aviso por 6 segundos; um aviso novo substitui o anterior e reinicia a contagem. */
  mostrar: (aviso: AvisoEntrada) => void;
  fechar: () => void;
}

// A contagem e o aviso moram aqui, e não no componente, para sobreviverem à troca de tela.
let temporizador: ReturnType<typeof setTimeout> | null = null;
let ultimoId = 0;

const cancelarContagem = () => {
  if (temporizador === null) return;
  clearTimeout(temporizador);
  temporizador = null;
};

export const useAvisoStore = create<AvisoState>((set, get) => ({
  aviso: null,
  mostrar: (entrada) => {
    cancelarContagem();
    ultimoId += 1;
    set({ aviso: { ...entrada, id: ultimoId } });
    temporizador = setTimeout(() => get().fechar(), DURACAO_EM_MS);
  },
  fechar: () => {
    cancelarContagem();
    set({ aviso: null });
  },
}));
