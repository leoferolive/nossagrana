import { Chip, GrupoDeChips } from './chip';

interface ChipsDePagamentoProps {
  metodos: { id: string; nome: string }[];
  /** Vazio quando nenhuma forma foi escolhida (válido: o pagamento é opcional). */
  selecionadoId: string;
  onEscolher: (metodoId: string) => void;
}

/** Pago com: um chip por forma de pagamento ativa; tocar na escolhida desmarca. */
export const ChipsDePagamento = ({ metodos, selecionadoId, onEscolher }: ChipsDePagamentoProps) => {
  if (metodos.length === 0) return null;
  return (
    <GrupoDeChips titulo="Pago com">
      {metodos.map((m) => (
        <Chip
          key={m.id}
          selecionado={m.id === selecionadoId}
          onClick={() => onEscolher(m.id === selecionadoId ? '' : m.id)}
        >
          {m.nome}
        </Chip>
      ))}
    </GrupoDeChips>
  );
};
