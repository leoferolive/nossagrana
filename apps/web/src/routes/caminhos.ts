/** Endereço de cada tela sem parâmetro. Os endereços não mudam entre os PRs da Entrega 2. */
export const CAMINHOS = {
  entrar: '/entrar',
  cadastro: '/cadastro',
  boasVindas: '/boas-vindas',
  familias: '/familias',
  inicio: '/',
  extrato: '/extrato',
  planejar: '/planejar',
  contas: '/planejar/contas',
  limites: '/planejar/limites',
  cofrinhos: '/planejar/cofrinhos',
  mais: '/mais',
  relatorios: '/mais/relatorios',
  historico: '/mais/historico',
  familia: '/mais/familia',
  categorias: '/mais/categorias',
  metodosPagamento: '/mais/metodos-pagamento',
  perfil: '/mais/perfil',
  ajuda: '/mais/ajuda',
} as const;

// Identificadores de tela herdados da navegação por estado: as páginas e o AppShell
// ainda falam nesse vocabulário até o PR seguinte.
const CAMINHO_POR_TELA: Record<string, string> = {
  login: CAMINHOS.entrar,
  'sign-up': CAMINHOS.cadastro,
  onboarding: CAMINHOS.boasVindas,
  'familia-selector': CAMINHOS.familias,
  dashboard: CAMINHOS.inicio,
  extrato: CAMINHOS.extrato,
  lancamentos: CAMINHOS.contas,
  orcamento: CAMINHOS.limites,
  cofrinhos: CAMINHOS.cofrinhos,
  configuracoes: CAMINHOS.mais,
  relatorios: CAMINHOS.relatorios,
  historico: CAMINHOS.historico,
  'family-settings': CAMINHOS.familia,
  categorias: CAMINHOS.categorias,
  'metodos-pagamento': CAMINHOS.metodosPagamento,
  perfil: CAMINHOS.perfil,
  ajuda: CAMINHOS.ajuda,
};

const TELA_POR_CAMINHO: Record<string, string> = Object.fromEntries(
  Object.entries(CAMINHO_POR_TELA).map(([tela, caminho]) => [caminho, tela]),
);

const PREFIXO_COFRINHO = `${CAMINHOS.cofrinhos}/`;
const PREFIXO_FATURA = `${CAMINHOS.planejar}/fatura/`;

export const caminhoDoCofrinho = (cofrinhoId: string): string =>
  `${PREFIXO_COFRINHO}${encodeURIComponent(cofrinhoId)}`;

export const caminhoDaFatura = (metodoId: string, mes: string): string =>
  `${PREFIXO_FATURA}${encodeURIComponent(metodoId)}?mes=${encodeURIComponent(mes)}`;

/** Traduz o identificador de tela de hoje no endereço; desconhecido cai no Início. */
export const caminhoDaTela = (tela: string): string => CAMINHO_POR_TELA[tela] ?? CAMINHOS.inicio;

/** Caminho inverso, para o AppShell saber a aba ativa; desconhecido cai em `dashboard`. */
export const telaDoCaminho = (pathname: string): string => {
  if (pathname.startsWith(PREFIXO_COFRINHO)) return 'cofrinho-detalhe';
  if (pathname.startsWith(PREFIXO_FATURA)) return 'fatura';
  return TELA_POR_CAMINHO[pathname] ?? 'dashboard';
};

/** Endereços que carregam id de outro registro (cofrinho, método de pagamento) no caminho. */
export const ehEnderecoComId = (pathname: string): boolean =>
  pathname.startsWith(PREFIXO_COFRINHO) || pathname.startsWith(PREFIXO_FATURA);
