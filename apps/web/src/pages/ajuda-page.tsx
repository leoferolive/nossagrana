import { useState } from 'react';

interface AjudaPageProps {
  onBack: () => void;
}

const FAQ = [
  {
    pergunta: 'O que é mês de referência?',
    secao: 'mês de referência',
    resposta:
      'O mês de referência determina em qual mês a transação é contabilizada. Para cartões de crédito: se a transação ocorreu antes da data de fechamento, é do mês atual; se ocorreu depois, vai para o próximo mês. Para outros métodos, é o mês da data da transação.',
  },
  {
    pergunta: 'Como funciona parcelado?',
    secao: 'parcelado',
    resposta:
      'Ao marcar uma transação como parcelada, o sistema divide o valor total pelo número de parcelas e cria um lançamento para cada mês. Cada parcela exibe "Parcela X/N" no extrato.',
  },
  {
    pergunta: 'O que é uma transação recorrente?',
    secao: 'recorrente',
    resposta:
      'Uma transação recorrente é repetida automaticamente conforme a frequência escolhida (mensal, quinzenal ou semanal). Você pode definir uma data de encerramento ou deixar em aberto. Ao cancelar, os lançamentos futuros são removidos.',
  },
  {
    pergunta: 'O que é snapshot mensal?',
    secao: 'snapshot',
    resposta:
      'Um snapshot é uma "foto" do mês financeiro gerada automaticamente no último dia de cada mês. Ele registra totais de receitas, despesas e saldo por categoria e membro. Uma vez gerado, nunca é alterado. Se você editar uma transação de um mês já fechado, o snapshot é marcado como divergente.',
  },
  {
    pergunta: 'O que significa "divergente" no histórico?',
    secao: 'snapshot',
    resposta:
      'Quando um snapshot é "divergente", significa que o valor original registrado no snapshot difere dos valores atuais do mês — geralmente porque uma transação foi editada ou excluída depois que o snapshot foi gerado.',
  },
  {
    pergunta: 'Como usar o orçamento?',
    secao: 'orçamento',
    resposta:
      'Na tela de Orçamento, você define um limite de gastos por categoria. O sistema calcula automaticamente o percentual utilizado. Quando ultrapassar 80%, o indicador fica amarelo; acima de 100%, vermelho.',
  },
  {
    pergunta: 'Como ver a fatura do cartão?',
    secao: 'fatura',
    resposta:
      'Acesse "Cartões e Pagamentos", selecione o cartão desejado e clique em "Ver Fatura". A fatura lista todas as transações do mês de referência para aquele cartão.',
  },
];

const SECOES = ['mês de referência', 'parcelado', 'recorrente', 'snapshot', 'orçamento', 'fatura'];

export const AjudaPage = ({ onBack }: AjudaPageProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 text-sm"
          >
            Voltar
          </button>
          <h1 className="text-xl font-bold">Ajuda / FAQ</h1>
        </div>

        {SECOES.map((secao) => {
          const perguntas = FAQ.filter((f) => f.secao === secao);
          if (perguntas.length === 0) return null;
          return (
            <div key={secao} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {secao}
              </h2>
              <div className="space-y-1">
                {perguntas.map((faq) => {
                  const idx = FAQ.indexOf(faq);
                  return (
                    <div key={idx} className="rounded-xl border border-border bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggle(idx)}
                        className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors flex justify-between items-center"
                      >
                        <span>{faq.pergunta}</span>
                        <span className="text-muted-foreground ml-2">{openIndex === idx ? '▲' : '▼'}</span>
                      </button>
                      {openIndex === idx && (
                        <div className="px-4 pb-3 text-sm text-muted-foreground border-t border-border">
                          <p className="pt-2">{faq.resposta}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
