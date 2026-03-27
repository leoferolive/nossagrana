export interface VoiceParseResult {
  tipo: 'receita' | 'despesa' | null;
  valor: string | null;
  descricao: string | null;
  data: string | null;
}

const DESPESA_KEYWORDS = ['gastei', 'paguei', 'comprei', 'gastar', 'pagar', 'comprar', 'despesa'];
const RECEITA_KEYWORDS = [
  'recebi',
  'ganhei',
  'receber',
  'ganhar',
  'receita',
  'salário',
  'salario',
  'freelance',
];

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  dois: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
  mil: 1000,
};

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terça: 2,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sábado: 6,
  sabado: 6,
};

const PREPOSITIONS = [
  'no',
  'na',
  'nos',
  'nas',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'com',
  'pra',
  'para',
  'por',
  'pelo',
  'pela',
  'ao',
];

// Filler words and currency indicators to strip from description
const FILLER_WORDS = ['é', 'eh', 'ah', 'hm', 'brl', 'reais', 'real', 'conto', 'contos'];

const ALL_TIPO_KEYWORDS = [...DESPESA_KEYWORDS, ...RECEITA_KEYWORDS];
const DATE_KEYWORDS = ['anteontem', 'ontem', 'hoje', ...Object.keys(WEEKDAY_MAP)];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractTipo(text: string): 'receita' | 'despesa' | null {
  const lower = text.toLowerCase();
  for (const kw of DESPESA_KEYWORDS) {
    if (lower.includes(kw)) return 'despesa';
  }
  for (const kw of RECEITA_KEYWORDS) {
    if (lower.includes(kw)) return 'receita';
  }
  return null;
}

function extractValor(text: string): { valor: string | null; matched: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  // Pattern 0: "100 brl" or "brl 100" — treat BRL like R$
  const brlMatch = lower.match(/(?:brl\s*(\d+)([.,](\d{1,2}))?|(\d+)([.,](\d{1,2}))?\s*brl)/);
  if (brlMatch) {
    const intPart = brlMatch[1] || brlMatch[4];
    const decPart = brlMatch[3] || brlMatch[6] || '00';
    matched.push(brlMatch[0]);
    return { valor: `${intPart}.${decPart.padEnd(2, '0')}`, matched };
  }

  // Pattern 1: R$ 123,45 or R$ 123.45 or R$ 123
  const rsCurrencyMatch = lower.match(/r\$\s*(\d+)([.,](\d{1,2}))?/);
  if (rsCurrencyMatch) {
    const intPart = rsCurrencyMatch[1];
    const decPart = rsCurrencyMatch[3] || '00';
    matched.push(rsCurrencyMatch[0]);
    return { valor: `${intPart}.${decPart.padEnd(2, '0')}`, matched };
  }

  // Pattern 2: "123 e 45" (meaning 123.45)
  const ePattern = lower.match(/(\d+)\s+e\s+(\d{1,2})(?!\w)/);
  if (ePattern) {
    matched.push(ePattern[0]);
    return { valor: `${ePattern[1]}.${ePattern[2].padEnd(2, '0')}`, matched };
  }

  // Pattern 3: "123,45" or "123.45"
  const decimalMatch = lower.match(/(\d+)[.,](\d{1,2})/);
  if (decimalMatch) {
    matched.push(decimalMatch[0]);
    return { valor: `${decimalMatch[1]}.${decimalMatch[2].padEnd(2, '0')}`, matched };
  }

  // Pattern 4: "123 reais" or standalone number
  const reaisMatch = lower.match(/(\d+)\s*reais/);
  if (reaisMatch) {
    matched.push(reaisMatch[0]);
    return { valor: `${reaisMatch[1]}.00`, matched };
  }

  const standaloneNum = lower.match(/\b(\d+)\b/);
  if (standaloneNum) {
    matched.push(standaloneNum[0]);
    return { valor: `${standaloneNum[1]}.00`, matched };
  }

  // Pattern 5: Number words with word boundary
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp('\\b' + word + '\\b');
    if (regex.test(lower)) {
      matched.push(word);
      return { valor: `${value}.00`, matched };
    }
  }

  return { valor: null, matched };
}

function extractData(text: string): { data: string | null; matched: string[] } {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  const now = new Date();

  // Check "anteontem" before "ontem" to avoid substring issues
  if (lower.includes('anteontem')) {
    matched.push('anteontem');
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return { data: formatDate(d), matched };
  }

  if (lower.includes('ontem')) {
    matched.push('ontem');
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { data: formatDate(d), matched };
  }

  if (lower.includes('hoje')) {
    matched.push('hoje');
    return { data: formatDate(now), matched };
  }

  // Weekday names
  for (const [name, dayIndex] of Object.entries(WEEKDAY_MAP)) {
    if (lower.includes(name)) {
      matched.push(name);
      const currentDay = now.getDay();
      let diff = currentDay - dayIndex;
      if (diff <= 0) diff += 7;
      const d = new Date(now);
      d.setDate(d.getDate() - diff);
      return { data: formatDate(d), matched };
    }
  }

  return { data: null, matched };
}

function extractDescricao(text: string): string | null {
  let remaining = text.toLowerCase();

  // Remove tipo keywords
  for (const kw of ALL_TIPO_KEYWORDS) {
    remaining = remaining.replace(new RegExp('\\b' + kw + '\\b', 'g'), ' ');
  }

  // Remove valor patterns: R$/BRL prefix, numbers, "reais", number words
  remaining = remaining.replace(/r\$\s*\d+([.,]\d{1,2})?/g, ' ');
  remaining = remaining.replace(/\bbrl\b/g, ' ');
  remaining = remaining.replace(/\d+\s+e\s+\d{1,2}/g, ' ');
  remaining = remaining.replace(/\d+[.,]\d{1,2}/g, ' ');
  remaining = remaining.replace(/\d+\s*reais/g, ' ');
  remaining = remaining.replace(/\breais\b/g, ' ');
  remaining = remaining.replace(/\b\d+\b/g, ' ');

  // Remove number words
  for (const word of Object.keys(NUMBER_WORDS)) {
    remaining = remaining.replace(new RegExp('\\b' + word + '\\b', 'g'), ' ');
  }

  // Remove date keywords
  for (const kw of DATE_KEYWORDS) {
    remaining = remaining.replace(new RegExp('\\b' + kw + '\\b', 'g'), ' ');
  }

  // Remove prepositions
  for (const prep of PREPOSITIONS) {
    remaining = remaining.replace(new RegExp('\\b' + prep + '\\b', 'g'), ' ');
  }

  // Remove stray punctuation from transcription (before filler removal)
  remaining = remaining.replace(/[,;.!?]+/g, ' ');

  // Remove filler words and currency indicators
  // Use (?:^|\s) and (?:\s|$) instead of \b for accented characters like "é"
  for (const filler of FILLER_WORDS) {
    remaining = remaining.replace(new RegExp('(?:^|\\s)' + filler + '(?:\\s|$)', 'g'), ' ');
  }

  // Clean whitespace
  remaining = remaining.replace(/\s+/g, ' ').trim();

  return remaining.length > 0 ? remaining : null;
}

export function parseVoiceInput(transcript: string): VoiceParseResult {
  if (!transcript.trim()) {
    return { tipo: null, valor: null, descricao: null, data: null };
  }

  const tipo = extractTipo(transcript);
  const { valor } = extractValor(transcript);
  const { data } = extractData(transcript);
  const descricao = extractDescricao(transcript);

  return { tipo, valor, descricao, data };
}
