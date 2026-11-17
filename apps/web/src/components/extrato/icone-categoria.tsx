import {
  Briefcase,
  CircleDollarSign,
  Car,
  GraduationCap,
  Gift,
  HeartPulse,
  House,
  PiggyBank,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Ticket,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

type FamiliaDeCategoria = 'alimentacao' | 'saude' | 'lazer' | 'compras' | 'outros';

/** Classes completas (o Tailwind só gera o que aparece escrito por inteiro no código). */
const CORES: Record<FamiliaDeCategoria, string> = {
  alimentacao: 'bg-cat-alimentacao-bg text-cat-alimentacao-ink',
  saude: 'bg-cat-saude-bg text-cat-saude-ink',
  lazer: 'bg-cat-lazer-bg text-cat-lazer-ink',
  compras: 'bg-cat-compras-bg text-cat-compras-ink',
  outros: 'bg-cat-outros-bg text-cat-outros-ink',
};

const ICONE_DA_FAMILIA: Record<FamiliaDeCategoria, LucideIcon> = {
  alimentacao: ShoppingBasket,
  saude: HeartPulse,
  lazer: Ticket,
  compras: ShoppingBag,
  outros: CircleDollarSign,
};

/** Trechos do nome (sem acento, minúsculo) que levam à família; a primeira que casar vence. */
const FAMILIAS: ReadonlyArray<readonly [FamiliaDeCategoria, readonly string[]]> = [
  ['alimentacao', ['alimenta', 'mercado']],
  ['saude', ['saude', 'farmacia']],
  ['lazer', ['lazer']],
  ['compras', ['compra']],
];

/** Ícone próprio das categorias padrão que ficam na família "outros". */
const ICONE_DAS_DEMAIS: ReadonlyArray<readonly [readonly string[], LucideIcon]> = [
  [['moradia'], House],
  [['transporte'], Car],
  [['educa'], GraduationCap],
  [['assinatura'], Repeat],
  [['salario'], Briefcase],
  [['bonus'], Gift],
  [['investiment'], TrendingUp],
  [['cofrinho'], PiggyBank],
];

const normalizar = (nome: string): string =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const casa = (nome: string, trechos: readonly string[]): boolean =>
  trechos.some((trecho) => nome.includes(trecho));

/** Família visual de uma categoria pelo nome; o que não casa cai em "outros". */
const familiaDaCategoria = (nome: string): FamiliaDeCategoria => {
  const limpo = normalizar(nome);
  return FAMILIAS.find(([, trechos]) => casa(limpo, trechos))?.[0] ?? 'outros';
};

const iconeDaCategoria = (nome: string, familia: FamiliaDeCategoria): LucideIcon => {
  if (familia !== 'outros') return ICONE_DA_FAMILIA[familia];
  const limpo = normalizar(nome);
  return ICONE_DAS_DEMAIS.find(([trechos]) => casa(limpo, trechos))?.[1] ?? ICONE_DA_FAMILIA.outros;
};

/** Quadrado de 38×38 (raio 12) com o ícone da categoria, fundo claro e tinta escura da família. */
export const IconeCategoria = ({ nome }: { nome: string }) => {
  const familia = familiaDaCategoria(nome);
  const Icone = iconeDaCategoria(nome, familia);
  return (
    <span
      data-familia={familia}
      className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${CORES[familia]}`}
    >
      <Icone size={20} aria-hidden="true" />
    </span>
  );
};
