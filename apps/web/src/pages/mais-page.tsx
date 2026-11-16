import { Link } from 'react-router';

import { CabecalhoAba } from '../components/cabecalho-aba';
import { GRUPOS_DE_MAIS, type GrupoDeMenu, type ItemDeMenu } from '../components/grupos-de-mais';
import { IconChevron, IconSair } from '../components/icons';

interface MaisPageProps {
  onLogout: () => void;
}

const LINHA_CLASSES =
  'flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold transition-colors hover:bg-surface';

const LinhaDeLink = ({ item }: { item: ItemDeMenu }) => {
  const Icone = item.icone;
  return (
    <Link to={item.caminho} className={`${LINHA_CLASSES} text-text`}>
      <Icone size={20} className="text-text-muted" aria-hidden="true" />
      <span className="flex-1">{item.rotulo}</span>
      <IconChevron size={18} className="text-text-dim" aria-hidden="true" />
    </Link>
  );
};

const LinhaSair = ({ onLogout }: MaisPageProps) => (
  <button type="button" onClick={onLogout} className={`${LINHA_CLASSES} text-danger`}>
    <IconSair size={20} aria-hidden="true" />
    <span className="flex-1">Sair</span>
  </button>
);

const GrupoDeLinhas = ({ grupo, onLogout }: { grupo: GrupoDeMenu; onLogout?: () => void }) => {
  const idTitulo = `mais-grupo-${grupo.titulo}`;
  return (
    <section aria-labelledby={idTitulo}>
      <h2
        id={idTitulo}
        className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-text-dim"
      >
        {grupo.titulo}
      </h2>
      <ul className="divide-y divide-border-soft overflow-hidden rounded-[18px] bg-panel shadow-soft">
        {grupo.itens.map((item) => (
          <li key={item.caminho}>
            <LinhaDeLink item={item} />
          </li>
        ))}
        {onLogout && (
          <li>
            <LinhaSair onLogout={onLogout} />
          </li>
        )}
      </ul>
    </section>
  );
};

/** Tela Mais: no lugar de Configurações, reúne o que não cabe na barra em quatro grupos. */
export const MaisPage = ({ onLogout }: MaisPageProps) => (
  <div className="flex min-h-full flex-col bg-bg">
    <CabecalhoAba titulo="Mais" />
    <div className="flex flex-col gap-5 px-3.5 pb-6 md:px-6">
      {GRUPOS_DE_MAIS.map((grupo) => (
        <GrupoDeLinhas
          key={grupo.titulo}
          grupo={grupo}
          onLogout={grupo.titulo === 'Conta' ? onLogout : undefined}
        />
      ))}
    </div>
  </div>
);
