import { Navigate, Route, Routes } from 'react-router';

import type { FluxoSessao } from '@/hooks/use-fluxo-sessao';

import { AreaLogada } from './area-logada';
import { CAMINHOS } from './caminhos';
import { RotaAutenticada, RotaDeEntrada } from './guardas';
import {
  AjudaRota,
  CategoriasRota,
  CofrinhoDetalheRota,
  CofrinhosRota,
  ContasRota,
  ExtratoRota,
  FamiliaRota,
  FaturaRota,
  HistoricoRota,
  InicioRota,
  LimitesRota,
  MaisRota,
  MetodosPagamentoRota,
  PerfilRota,
  RelatoriosRota,
} from './telas-logadas';
import { BoasVindasRota, CadastroRota, EntrarRota, FamiliasRota } from './telas-publicas';

interface AppRotasProps {
  fluxo: FluxoSessao;
}

const irParaInicio = <Navigate to={CAMINHOS.inicio} replace />;

/** A árvore de endereços do app. A tabela dos caminhos está em `caminhos.ts`. */
export const AppRotas = ({ fluxo }: AppRotasProps) => (
  <Routes>
    <Route
      path={CAMINHOS.entrar}
      element={
        <RotaDeEntrada>
          <EntrarRota fluxo={fluxo} />
        </RotaDeEntrada>
      }
    />
    <Route
      path={CAMINHOS.cadastro}
      element={
        <RotaDeEntrada>
          <CadastroRota />
        </RotaDeEntrada>
      }
    />
    <Route
      path={CAMINHOS.boasVindas}
      element={
        <RotaAutenticada>
          <BoasVindasRota />
        </RotaAutenticada>
      }
    />
    <Route
      path={CAMINHOS.familias}
      element={
        <RotaAutenticada>
          <FamiliasRota fluxo={fluxo} />
        </RotaAutenticada>
      }
    />
    <Route element={<AreaLogada fluxo={fluxo} />}>
      <Route path={CAMINHOS.inicio} element={<InicioRota />} />
      <Route path={CAMINHOS.extrato} element={<ExtratoRota />} />
      {/* Até a tela Planejar existir (PR seguinte), /planejar abre as contas do mês. */}
      <Route path={CAMINHOS.planejar} element={<Navigate to={CAMINHOS.contas} replace />} />
      <Route path={CAMINHOS.contas} element={<ContasRota />} />
      <Route path={CAMINHOS.limites} element={<LimitesRota />} />
      <Route path={CAMINHOS.cofrinhos} element={<CofrinhosRota />} />
      <Route path={`${CAMINHOS.cofrinhos}/:cofrinhoId`} element={<CofrinhoDetalheRota />} />
      <Route path={`${CAMINHOS.planejar}/fatura/:metodoId`} element={<FaturaRota />} />
      <Route path={CAMINHOS.mais} element={<MaisRota />} />
      <Route path={CAMINHOS.relatorios} element={<RelatoriosRota />} />
      <Route path={CAMINHOS.historico} element={<HistoricoRota />} />
      <Route path={CAMINHOS.familia} element={<FamiliaRota />} />
      <Route path={CAMINHOS.categorias} element={<CategoriasRota />} />
      <Route path={CAMINHOS.metodosPagamento} element={<MetodosPagamentoRota />} />
      <Route path={CAMINHOS.perfil} element={<PerfilRota />} />
      <Route path={CAMINHOS.ajuda} element={<AjudaRota />} />
    </Route>
    <Route path="*" element={irParaInicio} />
  </Routes>
);
