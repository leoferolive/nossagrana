import { Link, useLocation } from 'react-router';

import { CAMINHOS } from '../routes/caminhos';

import { GRUPOS_DE_MAIS, type GrupoDeMenu, type ItemDeMenu } from './grupos-de-mais';
import {
  IconCofrinho,
  IconExtrato,
  IconInicio,
  IconOrcamento,
  IconPlanejar,
  IconSair,
} from './icons';

interface SidebarProps {
  onLogout: () => void;
  familiaNome?: string;
}

const GRUPO_DE_ABAS: GrupoDeMenu = {
  titulo: '',
  itens: [
    { rotulo: 'Início', caminho: CAMINHOS.inicio, icone: IconInicio },
    { rotulo: 'Extrato', caminho: CAMINHOS.extrato, icone: IconExtrato },
  ],
};

// Os destinos de Planejar que a tela Planejar reúne no celular, direto no menu do desktop.
const GRUPO_PLANEJAR: GrupoDeMenu = {
  titulo: 'Planejar',
  itens: [
    { rotulo: 'Planejar', caminho: CAMINHOS.planejar, icone: IconPlanejar },
    { rotulo: 'Contas do mês', caminho: CAMINHOS.contas, icone: IconPlanejar },
    { rotulo: 'Limites por categoria', caminho: CAMINHOS.limites, icone: IconOrcamento },
    { rotulo: 'Cofrinhos', caminho: CAMINHOS.cofrinhos, icone: IconCofrinho },
  ],
};

const GRUPOS: GrupoDeMenu[] = [GRUPO_DE_ABAS, GRUPO_PLANEJAR, ...GRUPOS_DE_MAIS];

/** O item fica marcado no próprio endereço e nos de baixo (cofrinho aberto marca Cofrinhos). */
const estaAtivo = (pathname: string, caminho: string): boolean =>
  caminho === CAMINHOS.inicio || caminho === CAMINHOS.planejar
    ? pathname === caminho
    : pathname === caminho || pathname.startsWith(`${caminho}/`);

const ItemDoMenu = ({ item, pathname }: { item: ItemDeMenu; pathname: string }) => {
  const Icone = item.icone;
  const ativo = estaAtivo(pathname, item.caminho);
  return (
    <Link
      to={item.caminho}
      aria-current={ativo ? 'page' : undefined}
      className={`flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        ativo
          ? 'bg-accent-soft font-bold text-success'
          : 'text-text-muted hover:bg-surface hover:text-text'
      }`}
    >
      <Icone size={16} aria-hidden="true" />
      <span>{item.rotulo}</span>
    </Link>
  );
};

const GrupoDoMenu = ({ grupo, pathname }: { grupo: GrupoDeMenu; pathname: string }) => {
  const itens = grupo.itens.map((item) => (
    <ItemDoMenu key={item.caminho} item={item} pathname={pathname} />
  ));
  if (!grupo.titulo) return <div>{itens}</div>;
  const idTitulo = `menu-grupo-${grupo.titulo}`;
  return (
    <section aria-labelledby={idTitulo} className="mt-1 border-t border-border pt-1">
      <h2
        id={idTitulo}
        className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-text-dim"
      >
        {grupo.titulo}
      </h2>
      {itens}
    </section>
  );
};

export const Sidebar = ({ onLogout, familiaNome }: SidebarProps) => {
  const { pathname } = useLocation();
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-lg font-extrabold tracking-tight text-success">NossaGrana</h1>
        <p className="mt-0.5 text-xs text-text-muted">{familiaNome ?? 'Finanças da família'}</p>
      </div>

      <nav aria-label="Menu lateral" className="flex-1 overflow-y-auto py-2">
        {GRUPOS.map((grupo) => (
          <GrupoDoMenu key={grupo.titulo || 'abas'} grupo={grupo} pathname={pathname} />
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          aria-label="Sair"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger-soft"
        >
          <IconSair size={16} aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
};
