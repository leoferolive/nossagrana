import { useState } from 'react';

interface AjudaPageProps {
  onBack?: () => void;
}

const FAQ = [
  {
    categoria: 'Transações',
    itens: [
      {
        pergunta: 'Como cadastrar uma transação?',
        resposta:
          "Clique no botão '+ Nova Transação' no canto superior direito. Preencha valor, categoria, descrição e método de pagamento. Clique em 'Salvar'.",
      },
      {
        pergunta: 'Como funciona o parcelamento?',
        resposta:
          "Ao marcar 'Parcelado' e informar o número de parcelas, o sistema cria automaticamente uma transação para cada parcela nos meses seguintes, com o valor dividido igualmente.",
      },
      {
        pergunta: 'O que é uma transação recorrente?',
        resposta:
          'Uma transação que se repete automaticamente. Ex: Netflix, aluguel. O sistema cria o lançamento todo mês até você cancelar.',
      },
    ],
  },
  {
    categoria: 'Orçamento',
    itens: [
      {
        pergunta: 'O que significa o alerta de orçamento?',
        resposta:
          'Amarelo = você atingiu 80% do limite. Vermelho = ultrapassou 100%. Ajuste seus gastos ou edite o limite.',
      },
      {
        pergunta: 'Posso mudar o limite no meio do mês?',
        resposta:
          'Sim. O novo limite começa a valer imediatamente, e o histórico do limite anterior é preservado.',
      },
    ],
  },
  {
    categoria: 'Família',
    itens: [
      {
        pergunta: 'Como convidar alguém para minha família?',
        resposta:
          'Vá em Família > Código de Convite. Compartilhe o código com a pessoa. Ela pode usá-lo no cadastro para entrar direto.',
      },
      {
        pergunta: 'Posso editar transações de outros membros?',
        resposta: 'Sim. Todos os membros da família podem editar todas as transações.',
      },
    ],
  },
  {
    categoria: 'Relatórios',
    itens: [
      {
        pergunta: 'O que é o snapshot mensal?',
        resposta:
          "No fim de cada mês, o sistema salva uma 'foto' dos totais. Assim, mesmo que você edite algo depois, o relatório original fica preservado.",
      },
      {
        pergunta: "O que significa 'Divergente'?",
        resposta:
          'Significa que transações daquele mês foram editadas após o snapshot. O relatório original continua disponível para comparação.',
      },
    ],
  },
];

export const AjudaPage = ({ onBack }: AjudaPageProps) => {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const toggle = (key: string) => setOpenKey(openKey === key ? null : key);

  return (
    <div className="min-h-screen bg-bg text-text p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-2 px-3 py-1.5 rounded-lg bg-surface text-text-muted hover:bg-surface/80 text-sm"
            >
              Voltar
            </button>
          )}
          <h1 className="text-2xl font-bold">Ajuda</h1>
          <p className="text-sm text-text-muted mt-1">Perguntas frequentes sobre o NossaGrana</p>
        </div>

        <div className="flex flex-col gap-4">
          {FAQ.map((section) => (
            <div
              key={section.categoria}
              data-section={section.categoria}
              className="rounded-xl border border-border bg-panel overflow-hidden"
            >
              <h2 className="px-4 pt-4 pb-2 text-sm font-semibold text-text">
                {section.categoria}
              </h2>
              <div className="px-4 pb-2">
                {section.itens.map((faq, i) => {
                  const key = `${section.categoria}-${i}`;
                  const isOpen = openKey === key;
                  const isLast = i === section.itens.length - 1;
                  return (
                    <div key={key} data-faq-item className={isLast ? '' : 'border-b border-border'}>
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        className="w-full text-left py-3 text-sm font-medium hover:bg-surface/50 transition-colors flex justify-between items-center"
                      >
                        <span className={isOpen ? 'text-success' : 'text-text'}>
                          {faq.pergunta}
                        </span>
                        <span
                          className={`text-text-muted ml-2 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        >
                          ›
                        </span>
                      </button>
                      {isOpen && (
                        <div className="pb-3 text-xs text-text-muted leading-relaxed border-l-2 border-success pl-3">
                          {faq.resposta}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
