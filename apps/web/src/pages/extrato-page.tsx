import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CabecalhoAba } from '../components/cabecalho-aba';
import { ErrorBanner } from '../components/error-banner';
import { CabecalhoDoDia } from '../components/extrato/cabecalho-do-dia';
import { FiltrosDoExtrato, type FiltroTipo } from '../components/extrato/filtros-do-extrato';
import { LinhaDeLancamento } from '../components/extrato/linha-de-lancamento';
import { ResumoDoPeriodo } from '../components/extrato/resumo-do-periodo';
import {
  transacaoService,
  metodoPagamentoService,
  categoriaService,
} from '@/services/core-financeiro.service';
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

/**
 * Carrega o mês. Depois de uma gravação (`versao` muda) recarrega o mesmo mês em silêncio, sem
 * trocar a lista por "Carregando"; resposta de mês ou família que já mudou é descartada.
 * `tentarDeNovo` repete a busca como se fosse a primeira (com "Carregando").
 */
const useTransacoesDoMes = (familiaId: string, mesReferencia: string) => {
  const setTransacoes = useTransacaoStore((s) => s.setTransacoes);
  const setCarregando = useTransacaoStore((s) => s.setCarregando);
  const versao = useTransacaoStore((s) => s.versao);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const chaveCarregada = useRef('');

  useEffect(() => {
    if (!familiaId) return;
    const chave = `${familiaId}|${mesReferencia}|${tentativa}`;
    const silencioso = chaveCarregada.current === chave;
    chaveCarregada.current = chave;
    let ativo = true;
    if (!silencioso) {
      setFalhou(false);
      setCarregando(true);
    }
    transacaoService
      .listar({ mesReferencia }, familiaId)
      .then((res) => {
        if (!ativo) return;
        setTransacoes(res.transacoes);
        setFalhou(false);
      })
      .catch(() => {
        if (!ativo || silencioso) return;
        setTransacoes([]);
        setFalhou(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [familiaId, mesReferencia, tentativa, versao, setCarregando, setTransacoes]);

  return { falhou, tentarDeNovo: () => setTentativa((n) => n + 1) };
};

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

export const ExtratoPage = ({
  familiaId,
  onNovaTransacao: _onNovaTransacao,
  onEditarTransacao,
}: ExtratoPageProps) => {
  const { transacoes, carregando } = useTransacaoStore();
  const [erro, setErro] = useState<string | null>(null);
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState('');

  const { falhou, tentarDeNovo } = useTransacoesDoMes(familiaId, mesReferencia);
  const { metodosMap, categoriasMap } = useCadastros(familiaId, setErro);

  const filtradas = useMemo(
    () => filtrar(transacoes, filtroTipo, busca),
    [transacoes, filtroTipo, busca],
  );

  const nomeDaCategoria = useCallback(
    (id: string | null) => (id ? categoriasMap.get(id) : undefined) ?? SEM_CATEGORIA,
    [categoriasMap],
  );
  const nomeDoMetodo = useCallback(
    (id: string | null) => (id ? metodosMap.get(id) : undefined) ?? null,
    [metodosMap],
  );

  const exportarCSV = () => {
    const csv = montarCsv(
      filtradas,
      (id) => (id ? (categoriasMap.get(id) ?? '—') : '—'),
      (id) => (id ? (metodosMap.get(id) ?? '—') : '—'),
    );
    baixarCsv(csv, `extrato-${mesReferencia}.csv`);
  };

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <ErrorBanner error={erro} />
      <CabecalhoAba titulo="Extrato" mes={mesReferencia} onMesChange={setMesReferencia} />

      <div className="mx-auto w-full max-w-3xl pb-6">
        {carregando && <Mensagem>Carregando...</Mensagem>}
        {!carregando && falhou && <ErroAoCarregar onTentarDeNovo={tentarDeNovo} />}
        {!carregando && !falhou && (
          <ConteudoDoExtrato
            transacoes={transacoes}
            filtradas={filtradas}
            filtroTipo={filtroTipo}
            onFiltro={setFiltroTipo}
            busca={busca}
            onBusca={setBusca}
            mesReferencia={mesReferencia}
            onExportar={exportarCSV}
            nomeDaCategoria={nomeDaCategoria}
            nomeDoMetodo={nomeDoMetodo}
            onAbrir={onEditarTransacao}
          />
        )}
      </div>
    </div>
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

interface ConteudoDoExtratoProps extends Omit<ListaPorDiaProps, 'dias'> {
  transacoes: Transacao[];
  filtradas: Transacao[];
  filtroTipo: FiltroTipo;
  onFiltro: (filtro: FiltroTipo) => void;
  busca: string;
  onBusca: (busca: string) => void;
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
          {textoDaListaVazia(transacoes.length, filtroTipo, busca, mesReferencia)}
        </Mensagem>
      )}
      <ListaPorDia
        dias={dias}
        nomeDaCategoria={props.nomeDaCategoria}
        nomeDoMetodo={props.nomeDoMetodo}
        onAbrir={props.onAbrir}
      />
    </>
  );
};

interface ListaPorDiaProps {
  dias: ReturnType<typeof agruparPorDia>;
  nomeDaCategoria: (id: string | null) => string;
  nomeDoMetodo: (id: string | null) => string | null;
  onAbrir: (transacao: Transacao) => void;
}

const ListaPorDia = ({ dias, nomeDaCategoria, nomeDoMetodo, onAbrir }: ListaPorDiaProps) => {
  const hoje = getTodayLocalISO();
  return (
    <div className="mt-2">
      {dias.map((dia) => (
        <section key={dia.data}>
          <CabecalhoDoDia rotulo={rotuloDoDia(dia.data, hoje)} totalCentavos={dia.totalCentavos} />
          <ul className="mx-3.5 divide-y divide-border-soft overflow-hidden rounded-[14px] bg-panel shadow-soft">
            {dia.transacoes.map((t) => (
              <LinhaDeLancamento
                key={t.id}
                transacao={t}
                categoriaNome={nomeDaCategoria(t.categoriaId)}
                metodoNome={nomeDoMetodo(t.metodoPagamentoId)}
                onAbrir={onAbrir}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
