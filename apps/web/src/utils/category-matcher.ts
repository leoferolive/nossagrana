export interface CategoryMatch {
  categoriaId: string;
  confidence: 'high' | 'medium' | 'low';
}

const KEYWORDS: Record<string, string[]> = {
  Alimentação: [
    'mercado',
    'supermercado',
    'almoço',
    'jantar',
    'restaurante',
    'padaria',
    'café',
    'ifood',
    'comida',
    'lanche',
  ],
  Transporte: [
    'uber',
    'gasolina',
    'combustível',
    'estacionamento',
    'ônibus',
    'metrô',
    'pedágio',
    '99',
    'taxi',
  ],
  Moradia: [
    'aluguel',
    'condomínio',
    'luz',
    'água',
    'gás',
    'internet',
    'energia',
    'conta de luz',
    'conta de água',
  ],
  Saúde: [
    'farmácia',
    'farmacia',
    'remédio',
    'remedio',
    'médico',
    'medico',
    'consulta',
    'exame',
    'dentista',
    'plano de saúde',
  ],
  Educação: ['escola', 'faculdade', 'curso', 'livro', 'material escolar', 'mensalidade'],
  Lazer: ['cinema', 'netflix', 'spotify', 'jogo', 'bar', 'festa', 'viagem', 'hotel'],
  Vestuário: ['roupa', 'sapato', 'tênis', 'camisa', 'calça', 'loja'],
  Salário: ['salário', 'salario', 'freelance', 'pagamento', 'honorário'],
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function findKeywordCategory(descricao: string): string | null {
  const lower = descricao.toLowerCase();

  for (const [categoryName, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return categoryName;
      }
    }
  }

  return null;
}

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findCategoryByName(
  nome: string,
  categorias: Array<{ id: string; nome: string }>,
): { id: string; nome: string } | undefined {
  const normalized = stripAccents(nome.toLowerCase());
  return categorias.find((c) => stripAccents(c.nome.toLowerCase()) === normalized);
}

export function matchCategory(
  descricao: string,
  categorias: Array<{ id: string; nome: string }>,
): CategoryMatch | null {
  if (!descricao || categorias.length === 0) {
    return null;
  }

  // Layer 1: Keyword lookup
  const keywordCategory = findKeywordCategory(descricao);
  if (keywordCategory) {
    const match = findCategoryByName(keywordCategory, categorias);
    if (match) {
      return { categoriaId: match.id, confidence: 'high' };
    }
  }

  // Layer 2: Fuzzy match (accent-insensitive)
  const normalizedDescricao = stripAccents(descricao.toLowerCase());
  let bestMatch: { id: string; similarity: number } | null = null;

  for (const categoria of categorias) {
    const sim = similarity(normalizedDescricao, stripAccents(categoria.nome.toLowerCase()));
    if (sim >= 0.6 && (!bestMatch || sim > bestMatch.similarity)) {
      bestMatch = { id: categoria.id, similarity: sim };
    }
  }

  if (bestMatch) {
    return { categoriaId: bestMatch.id, confidence: 'medium' };
  }

  return null;
}
