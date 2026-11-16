import { useState } from 'react';
import { Link } from 'react-router';

import { CabecalhoAba } from '../components/cabecalho-aba';
import { ErrorBanner } from '../components/error-banner';
import {
  IconChevron,
  IconCofrinho,
  IconCartao,
  IconOrcamento,
  IconPlanejar,
} from '../components/icons';
import {
  usePlanejar,
  type ContagemDoMes,
  type DiasDoCartao,
  type FaturaDoMes,
} from '../hooks/use-planejar';
import { CAMINHOS, caminhoDaFatura } from '../routes/caminhos';
import { getCurrentMonth } from '../utils/date';

interface PlanejarPageProps {
  familiaId: string;
}

interface LinhaDoPlano {
  chave: string;
  rotulo: string;
  resumo: string | null;
  caminho: string;
  icone: typeof IconPlanejar;
}

const comPlural = (quantidade: number, singular: string, plural: string): string =>
  quantidade === 1 ? singular : plural;

const resumoDeContagem = (
  contagem: ContagemDoMes | null,
  singular: string,
  plural: string,
): string | null =>
  contagem &&
  `${contagem.parcial} de ${contagem.total} ${comPlural(contagem.parcial, singular, plural)}`;

const resumoDeContas = (modelos: number | null): string | null =>
  modelos === null ? null : `${modelos} ${comPlural(modelos, 'conta', 'contas')} no mês`;

/** Os dias cadastrados no cartão, sem converter em data: essa regra é da Entrega 4. */
const resumoDeDias = ({ fechamento, vencimento }: DiasDoCartao): string | null => {
  const partes = [
    fechamento !== null && `fecha dia ${fechamento}`,
    vencimento !== null && `vence dia ${vencimento}`,
  ].filter((parte): parte is string => parte !== false);
  return partes.length > 0 ? partes.join(' · ') : null;
};

const resumoDeCofrinhos = (ativos: number | null): string | null =>
  ativos === null ? null : `${ativos} ${comPlural(ativos, 'ativo', 'ativos')}`;

const linhaDeFatura = (fatura: FaturaDoMes, mes: string): LinhaDoPlano => ({
  chave: `fatura-${fatura.metodoId}`,
  rotulo: `Fatura ${fatura.nome}`,
  resumo: resumoDeDias(fatura.dias),
  caminho: caminhoDaFatura(fatura.metodoId, mes),
  icone: IconCartao,
});

const Linha = ({ linha }: { linha: LinhaDoPlano }) => {
  const Icone = linha.icone;
  return (
    <li>
      <Link
        to={linha.caminho}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3.5 text-[15px] font-semibold text-text transition-colors hover:bg-surface"
      >
        <Icone size={20} className="text-text-muted" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span className="max-w-full break-words">{linha.rotulo}</span>
          {linha.resumo && (
            <span className="text-[13px] font-semibold tabular-nums text-text-dim">
              {linha.resumo}
            </span>
          )}
        </span>
        <IconChevron size={18} className="text-text-dim" aria-hidden="true" />
      </Link>
    </li>
  );
};

/**
 * Tela de entrada de Planejar: quatro destinos (contas do mês, limites, faturas e cofrinhos), cada
 * um com o resumo que a tela de destino já calcula. As linhas navegam mesmo sem resumo, porque
 * esta tela é o caminho até essas telas no celular. O plano em quatro passos é da Entrega 4.
 */
export const PlanejarPage = ({ familiaId }: PlanejarPageProps) => {
  const [mes, setMes] = useState(getCurrentMonth);
  const { carregando, falhou, resumo } = usePlanejar(familiaId, mes);

  const linhas: LinhaDoPlano[] = [
    {
      chave: 'contas',
      rotulo: 'Contas do mês',
      resumo: resumoDeContas(resumo.contas),
      caminho: CAMINHOS.contas,
      icone: IconPlanejar,
    },
    {
      chave: 'limites',
      rotulo: 'Limites por categoria',
      resumo: resumoDeContagem(resumo.limites, 'estourado', 'estourados'),
      caminho: CAMINHOS.limites,
      icone: IconOrcamento,
    },
    ...resumo.faturas.map((fatura) => linhaDeFatura(fatura, mes)),
    {
      chave: 'cofrinhos',
      rotulo: 'Cofrinhos',
      resumo: resumoDeCofrinhos(resumo.cofrinhosAtivos),
      caminho: CAMINHOS.cofrinhos,
      icone: IconCofrinho,
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <CabecalhoAba titulo="Planejar" mes={mes} onMesChange={setMes} />
      {falhou && !carregando && (
        <ErrorBanner error="Não foi possível carregar todos os resumos do mês." />
      )}
      <div className="flex flex-col gap-2 px-3.5 pb-6 md:px-6">
        {carregando && (
          <p role="status" className="px-1 text-xs font-semibold text-text-dim">
            Carregando resumos...
          </p>
        )}
        <ul className="divide-y divide-border-soft overflow-hidden rounded-[18px] bg-panel shadow-soft">
          {linhas.map((linha) => (
            <Linha key={linha.chave} linha={linha} />
          ))}
        </ul>
      </div>
    </div>
  );
};
