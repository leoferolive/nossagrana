import { type LucideIcon } from 'lucide-react';

import { FirstTimeTour } from '../components/first-time-tour';
import {
  IconAjuda,
  IconCartao,
  IconChevron,
  IconExtrato,
  IconFamilia,
  IconHistorico,
  IconOrcamento,
  IconVoltar,
} from '../components/icons';

interface ConfiguracoesPageProps {
  onBack: () => void;
  onGoToCategorias: () => void;
  onGoToMetodosPagamento: () => void;
  onGoToOrcamento: () => void;
  onGoToFamilia: () => void;
  onGoToHistorico: () => void;
  onGoToAjuda: () => void;
}

interface MenuItem {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}

export const ConfiguracoesPage = ({
  onBack,
  onGoToCategorias,
  onGoToMetodosPagamento,
  onGoToOrcamento,
  onGoToFamilia,
  onGoToHistorico,
  onGoToAjuda,
}: ConfiguracoesPageProps) => {
  const items: MenuItem[] = [
    { label: 'Categorias', description: 'Gerencie as categorias de gastos', icon: IconExtrato, onClick: onGoToCategorias },
    { label: 'Cartões e Pagamentos', description: 'Métodos de pagamento cadastrados', icon: IconCartao, onClick: onGoToMetodosPagamento },
    { label: 'Orçamento', description: 'Limites de gasto por categoria', icon: IconOrcamento, onClick: onGoToOrcamento },
    { label: 'Família', description: 'Membros, convites e configurações', icon: IconFamilia, onClick: onGoToFamilia },
    { label: 'Histórico', description: 'Meses fechados e snapshots', icon: IconHistorico, onClick: onGoToHistorico },
    { label: 'Ajuda', description: 'FAQ e guia de uso', icon: IconAjuda, onClick: onGoToAjuda },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <FirstTimeTour
        tourKey="configuracoes"
        steps={[
          { title: 'Configurações', description: 'Acesse rapidamente todas as seções do app por aqui.' },
        ]}
      />

      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          className="text-text-muted transition hover:text-text"
        >
          <IconVoltar size={20} />
        </button>
        <h1 className="text-lg font-bold text-text">Configurações</h1>
      </header>

      <main className="flex-1 p-4">
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <button
                  type="button"
                  aria-label={item.label}
                  onClick={item.onClick}
                  className="flex w-full items-center gap-4 rounded-xl border border-border bg-panel px-4 py-4 text-left transition hover:bg-surface"
                >
                  <Icon size={20} className="shrink-0 text-text-muted" />
                  <div className="flex-1">
                    <p className="font-semibold text-text">{item.label}</p>
                    <p className="text-xs text-text-muted">{item.description}</p>
                  </div>
                  <IconChevron size={16} className="shrink-0 text-text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
};
