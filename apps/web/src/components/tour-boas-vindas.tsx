import { FirstTimeTour } from './first-time-tour';
import { IconAdicionar, IconInicio, IconMais, IconPlanejar } from './icons';
import { TOUR_DE_BOAS_VINDAS } from '../utils/tour';

const PASSOS = [
  {
    icon: IconInicio,
    title: 'Início',
    description: 'Aqui você vê o saldo do mês, quanto entrou e quanto saiu.',
  },
  {
    icon: IconAdicionar,
    title: 'Lançar',
    description: 'Toque no + para lançar uma despesa ou receita. Segure para lançar por voz.',
  },
  {
    icon: IconPlanejar,
    title: 'Planejar',
    description: 'Contas do mês, limites por categoria, faturas e cofrinhos ficam aqui.',
  },
  {
    icon: IconMais,
    title: 'Mais',
    description: 'Relatórios, família, cadastros e a sua conta ficam aqui.',
  },
];

/** O único tour do app, mostrado uma vez no primeiro acesso ao Início. */
export const TourBoasVindas = () => <FirstTimeTour tourKey={TOUR_DE_BOAS_VINDAS} steps={PASSOS} />;
