/**
 * Ritmo da suíte dentro do limite de requisições da API.
 *
 * O ambiente isolado roda com o limite de produção ligado: 3 cadastros, 5 logins e 10 refreshes
 * por minuto por IP (`auth.routes.ts`). O servidor recusa `NODE_ENV=test` de propósito, então a
 * suíte não desliga o limite: ela espera a sua vez. Estourar o limite não vira 429 limpo (o login
 * devolve 500, defeito conhecido da API), e um 500 aqui nunca deve ser "tentado de novo" para não
 * esconder erro de verdade; por isso o estouro é evitado antes, não tratado depois.
 *
 * O uso fica num arquivo (`.ritmo/uso-api.json`, ignorado pelo git) e não em memória porque o
 * Playwright troca o processo do worker depois de uma falha, e duas execuções seguidas da suíte
 * precisam enxergar o que a anterior gastou. Em `test-results/` não serve: o Playwright o apaga
 * no começo de cada execução.
 *
 * `E2E_PAUSA_MS` é o intervalo mínimo entre dois cadastros (padrão: a janela dividida pelo limite,
 * mais folga). Com `E2E_PAUSA_MS=0` só a janela deslizante segue valendo, o que permite uma
 * rajada inicial de cadastros e depois espera.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type RotaLimitada = 'cadastro' | 'login';

const LIMITE_POR_JANELA: Record<RotaLimitada, number> = { cadastro: 3, login: 5 };
const JANELA_MS = 60_000;
// Folga para a diferença entre o relógio da suíte e o da API e para a latência da requisição.
const FOLGA_MS = 1_500;
const PAUSA_PADRAO_ENTRE_CADASTROS_MS = Math.ceil(JANELA_MS / LIMITE_POR_JANELA.cadastro) + 1_000;

const PASTA = join(__dirname, '..', '.ritmo');
const ARQUIVO = join(PASTA, 'uso-api.json');

type Uso = Record<RotaLimitada, number[]>;

const usoVazio = (): Uso => ({ cadastro: [], login: [] });

const lerUso = (): Uso => {
  try {
    const lido = JSON.parse(readFileSync(ARQUIVO, 'utf8')) as Partial<Uso>;
    return { cadastro: lido.cadastro ?? [], login: lido.login ?? [] };
  } catch {
    return usoVazio();
  }
};

const gravarUso = (uso: Uso): void => {
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(ARQUIVO, JSON.stringify(uso));
};

/** Pausa mínima entre cadastros em ms; `E2E_PAUSA_MS` inválida ou negativa volta ao padrão. */
const pausaEntreCadastrosMs = (): number => {
  const bruto = process.env.E2E_PAUSA_MS;
  if (bruto === undefined || bruto === '') return PAUSA_PADRAO_ENTRE_CADASTROS_MS;
  const valor = Number(bruto);
  return Number.isFinite(valor) && valor >= 0 ? valor : PAUSA_PADRAO_ENTRE_CADASTROS_MS;
};

const dormir = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

/** Quanto falta esperar para a rota ter vaga na janela deslizante e respeitar a pausa mínima. */
const esperaNecessariaMs = (rota: RotaLimitada, usos: number[], agora: number): number => {
  const recentes = usos.filter((t) => agora - t < JANELA_MS + FOLGA_MS);
  const ordenados = [...recentes].sort((a, b) => a - b);
  const aguardaJanela =
    ordenados.length >= LIMITE_POR_JANELA[rota]
      ? ordenados[ordenados.length - LIMITE_POR_JANELA[rota]] + JANELA_MS + FOLGA_MS - agora
      : 0;
  const ultimo = ordenados[ordenados.length - 1];
  const aguardaPausa =
    rota === 'cadastro' && ultimo !== undefined ? ultimo + pausaEntreCadastrosMs() - agora : 0;
  return Math.max(0, aguardaJanela, aguardaPausa);
};

/**
 * Espera até a rota ter vaga e a reserva (grava o instante). Toda chamada ao cadastro ou ao login,
 * pela API ou pela interface, precisa passar por aqui antes de acontecer.
 */
export async function reservarVaga(rota: RotaLimitada): Promise<void> {
  for (;;) {
    const uso = lerUso();
    const espera = esperaNecessariaMs(rota, uso[rota], Date.now());
    if (espera <= 0) {
      uso[rota] = [...uso[rota].filter((t) => Date.now() - t < JANELA_MS * 2), Date.now()];
      gravarUso(uso);
      return;
    }
    await dormir(espera);
  }
}

/** Tempo máximo que um passo que reserva vagas pode levar: uma janela inteira mais a pausa. */
export const TEMPO_MAXIMO_DE_VAGA_MS = JANELA_MS * 3;
