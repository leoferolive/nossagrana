import { CAMINHOS } from '../routes/caminhos';

import {
  IconAjuda,
  IconAlternarFamilia,
  IconCartao,
  IconCategoria,
  IconFamilia,
  IconHistorico,
  IconPerfil,
  IconRelatorio,
} from './icons';

export interface ItemDeMenu {
  rotulo: string;
  caminho: string;
  icone: typeof IconRelatorio;
}

export interface GrupoDeMenu {
  titulo: string;
  itens: ItemDeMenu[];
}

/**
 * Os grupos da tela Mais (sem o "Sair", que é ação e não endereço). O menu lateral do desktop
 * lê esta mesma lista, para as duas navegações não se separarem.
 */
export const GRUPOS_DE_MAIS: GrupoDeMenu[] = [
  {
    titulo: 'Análises',
    itens: [
      { rotulo: 'Relatórios', caminho: CAMINHOS.relatorios, icone: IconRelatorio },
      { rotulo: 'Histórico', caminho: CAMINHOS.historico, icone: IconHistorico },
    ],
  },
  {
    titulo: 'Família',
    itens: [
      { rotulo: 'Família', caminho: CAMINHOS.familia, icone: IconFamilia },
      { rotulo: 'Alternar família', caminho: CAMINHOS.familias, icone: IconAlternarFamilia },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { rotulo: 'Categorias', caminho: CAMINHOS.categorias, icone: IconCategoria },
      { rotulo: 'Métodos de pagamento', caminho: CAMINHOS.metodosPagamento, icone: IconCartao },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      { rotulo: 'Perfil', caminho: CAMINHOS.perfil, icone: IconPerfil },
      { rotulo: 'Ajuda', caminho: CAMINHOS.ajuda, icone: IconAjuda },
    ],
  },
];
