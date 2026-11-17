import { useEffect, useMemo, useState } from 'react';

import { CabecalhoAba } from '../components/cabecalho-aba';
import { ErrorBanner } from '../components/error-banner';
import { CabecalhoDoDia } from '../components/extrato/cabecalho-do-dia';
import { FiltrosDoExtrato, type FiltroTipo } from '../components/extrato/filtros-do-extrato';
import { ExtratoContexto, type DadosDoExtrato } from '../components/extrato/extrato-contexto';
import { LinhaDeLancamento } from '../components/extrato/linha-de-lancamento';
import { ResumoDoPeriodo } from '../components/extrato/resumo-do-periodo';
import { metodoPagamentoService, categoriaService } from '@/services/core-financeiro.service';
import { useTransacoesDoMes } from '@/hooks/use-transacoes-do-mes';
import { useCategoriaStore } from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';
import { useTransacaoStore } from '@/stores/transacao.store';
import { getCurrentMonth, getTodayLocalISO } from '@/utils/date';
import { agruparPorDia, montarCsv, nomeDoMes, resumoDoPeriodo, rotuloDoDia } from '@/utils/extrato';

type Transacao = ReturnType<typeof useTransacaoStore.getState>['transacoes'][number];

interface ExtratoPageProps {
  familiaId: string;
  onNovaTransacao: () => void;
  onEditarTransacao: (transacao: Transacao) => void;
}

const SEM_CATEGORIA = 'Sem categoria';

const baixarCsv = (conteudo: string, nomeDoArquivo: string) => {
  const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo;
  a.click();
  URL.revokeObjectURL(url);
};

const Mensagem = ({ children }: { children: string }) => (
  <p className="px-5 py-8 text-center text-sm text-text-muted">{children}</p>
);

/** Carrega categorias e formas de pagamento da família se as stores ainda estão vazias. */
const useCadastros = (familiaId: string, onErro: (mensagem: string) => void) => {
  const { metodos } = useMetodoPagamentoStore();
  const { categorias } = useCategoriaStore();

  useEffect(() => {
    if (!familiaId) return;
    if (metodos.length === 0) {
      metodoPagamentoService
        .listar(familiaId)
        .then((res) => useMetodoPagamentoStore.getState().setMetodos(res.metodosPagamento))
        .catch(() => onErro('Erro ao carregar métodos de pagamento'));
    }
    if (categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => useCategoriaStore.getState().setCategorias(res.categorias))
        .catch(() => onErro('Erro ao carregar categorias'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId]);

  const metodosMap = useMemo(() => new Map(metodos.map((m) => [m.id, m.nome])), [metodos]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  return { metodosMap, categoriasMap };
};

const filtrar = (transacoes: Transacao[], tipo: FiltroTipo, busca: string): Transacao[] =>
  transacoes.filter((t) => {
    if (tipo !== 'todos' && t.tipo !== tipo) return false;
    return !busca || (t.descricao ?? '').toLowerCase().includes(busca.toLowerCase());
  });

const textoDaListaVazia = (
  total: number,
  tipo: FiltroTipo,
  busca: string,
  mesReferencia: string,
): string => {
  if (total === 0) return `Nenhum lançamento em ${nomeDoMes(mesReferencia)}`;
  if (busca) return `Nada encontrado para '${busca}'`;
  return tipo === 'receita' ? 'Nenhuma entrada neste mês' : 'Nenhuma saída neste mês';
};

/** Nomes de categoria e forma de pagamento, mais a ação de abrir, para as linhas do Extrato. */
const useDadosDoExtratoDaTela = (
  familiaId: string,
  onAbrir: DadosDoExtrato['onAbrir'],
  onErro: (mensagem: string) => void,
) => {
  const { metodosMap, categoriasMap } = useCadastros(familiaId, onErro);
  const dados = useMemo<DadosDoExtrato>(
    () => ({
      nomeDaCategoria: (id) => (id ? categoriasMap.get(id) : undefined) ?? SEM_CATEGORIA,
      nomeDoMetodo: (id) => (id ? metodosMap.get(id) : undefined) ?? null,
      onAbrir,
    }),
    [categoriasMap, metodosMap, onAbrir],
  );
  return { dados, categoriasMap, metodosMap };
};

export const ExtratoPage = ({
  familiaId,
  onNovaTransacao: _onNovaTransacao,
  onEditarTransacao,
}: ExtratoPageProps) => {
  const { transacoes, carregando } = useTransacaoStore();
  const [erro, setErro] = useState<string | null>(null);
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  // `null` com a busca fechada. Mora aqui (e não no filtro) para sobreviver a trocar de mês.
  const [busca, setBusca] = useState<string | null>(null);

  const { falhou, tentarDeNovo } = useTransacoesDoMes(familiaId, mesReferencia);
  const { dados, categoriasMap, metodosMap } = useDadosDoExtratoDaTela(
    familiaId,
    onEditarTransacao,
    setErro,
  );
  const filtradas = useMemo(
    () => filtrar(transacoes, filtroTipo, busca ?? ''),
    [transacoes, filtroTipo, busca],
  );

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <ErrorBanner error={erro} />
      <CabecalhoAba titulo="Extrato" mes={mesReferencia} onMesChange={setMesReferencia} />
      <div className="mx-auto w-full max-w-3xl pb-6">
        {carregando && <Mensagem>Carregando...</Mensagem>}
        {!carregando && falhou && <ErroAoCarregar onTentarDeNovo={tentarDeNovo} />}
        {!carregando && !falhou && (
          <ExtratoContexto.Provider value={dados}>
            <ConteudoDoExtrato
              transacoes={transacoes}
              filtradas={filtradas}
              filtroTipo={filtroTipo}
              onFiltro={setFiltroTipo}
              busca={busca}
              onBusca={setBusca}
              mesReferencia={mesReferencia}
              onExportar={() =>
                exportarExtrato(filtradas, mesReferencia, categoriasMap, metodosMap)
              }
            />
          </ExtratoContexto.Provider>
        )}
      </div>
    </div>
  );
};

const exportarExtrato = (
  filtradas: Transacao[],
  mesReferencia: string,
  categoriasMap: Map<string, string>,
  metodosMap: Map<string, string>,
) => {
  const nome = (mapa: Map<string, string>) => (id: string | null) =>
    (id ? mapa.get(id) : undefined) ?? '—';
  baixarCsv(
    montarCsv(filtradas, nome(categoriasMap), nome(metodosMap)),
    `extrato-${mesReferencia}.csv`,
  );
};

const ErroAoCarregar = ({ onTentarDeNovo }: { onTentarDeNovo: () => void }) => (
  <div className="px-5 py-8 text-center">
    <p className="text-sm text-text-muted">
      Não foi possível carregar o extrato. Verifique a conexão e tente de novo.
    </p>
    <button
      type="button"
      onClick={onTentarDeNovo}
      className="mt-3 min-h-11 rounded-full bg-success px-5 text-sm font-bold text-white"
    >
      Tentar de novo
    </button>
  </div>
);

interface ConteudoDoExtratoProps {
  transacoes: Transacao[];
  filtradas: Transacao[];
  filtroTipo: FiltroTipo;
  onFiltro: (filtro: FiltroTipo) => void;
  busca: string | null;
  onBusca: (busca: string | null) => void;
  mesReferencia: string;
  onExportar: () => void;
}

const ConteudoDoExtrato = (props: ConteudoDoExtratoProps) => {
  const { transacoes, filtradas, filtroTipo, busca, mesReferencia } = props;
  const dias = useMemo(() => agruparPorDia(filtradas), [filtradas]);
  return (
    <>
      <ResumoDoPeriodo resumo={resumoDoPeriodo(filtradas)} />
      <FiltrosDoExtrato
        filtro={filtroTipo}
        onFiltro={props.onFiltro}
        busca={busca}
        onBusca={props.onBusca}
        onExportar={props.onExportar}
      />
      {dias.length === 0 && (
        <Mensagem>
          {textoDaListaVazia(transacoes.length, filtroTipo, busca ?? '', mesReferencia)}
        </Mensagem>
      )}
      <ListaPorDia dias={dias} />
    </>
  );
};

const ListaPorDia = ({ dias }: { dias: ReturnType<typeof agruparPorDia> }) => {
  const hoje = getTodayLocalISO();
  return (
    <div className="mt-2">
      {dias.map((dia) => (
        <section key={dia.data}>
          <CabecalhoDoDia rotulo={rotuloDoDia(dia.data, hoje)} totalCentavos={dia.totalCentavos} />
          <ul className="mx-3.5 divide-y divide-border-soft overflow-hidden rounded-[14px] bg-panel shadow-soft">
            {dia.transacoes.map((t) => (
              <LinhaDeLancamento key={t.id} transacao={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
