import type { DadosDoPainel } from '@/hooks/use-dados-do-painel';

import { ChipsDeCategoria } from './chips-de-categoria';
import { ChipsDeData } from './chips-de-data';
import { ChipsDePagamento } from './chips-de-pagamento';
import { MaisOpcoes } from './mais-opcoes';
import { ValorDoLancamento } from './valor-do-lancamento';

interface CamposDoLancamentoProps {
  dados: DadosDoPainel;
  onVoz?: () => void;
  onExcluir?: (botao: HTMLElement) => void;
}

/** Os blocos do painel, de cima para baixo: valor, categoria, quando, pago com e mais opções. */
export const CamposDoLancamento = ({ dados, onVoz, onExcluir }: CamposDoLancamentoProps) => {
  const { campos, mudar, editando } = dados;
  return (
    <div className="flex flex-col gap-4">
      <ValorDoLancamento
        valor={campos.valor}
        onChange={(valor) => mudar({ valor })}
        onVoz={editando ? undefined : onVoz}
        focarAoAbrir={!editando}
      />
      <ChipsDeCategoria
        tipo={campos.tipo}
        maisUsadas={dados.maisUsadas}
        todas={dados.opcoesDeCategoria}
        selecionadaId={dados.categoriaIdValido}
        onEscolher={(categoriaId) => mudar({ categoriaId })}
      />
      <ChipsDeData data={campos.data} onChange={(data) => mudar({ data })} />
      <ChipsDePagamento
        metodos={dados.metodos}
        selecionadoId={campos.metodoPagamentoId}
        onEscolher={(metodoPagamentoId) => mudar({ metodoPagamentoId })}
      />
      <MaisOpcoes
        aberto={dados.maisAberto}
        onAlternar={dados.alternarMais}
        campos={campos}
        mudar={mudar}
        editando={editando}
        ehCredito={dados.ehCredito}
        onExcluir={onExcluir}
      />
    </div>
  );
};
