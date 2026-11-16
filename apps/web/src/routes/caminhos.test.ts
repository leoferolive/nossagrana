import { describe, expect, it } from 'vitest';

import {
  CAMINHOS,
  abaDoCaminho,
  caminhoDaFatura,
  caminhoDaTela,
  caminhoDoCofrinho,
  telaDoCaminho,
} from './caminhos';

const TELAS_SEM_PARAMETRO: Array<[string, string]> = [
  ['login', '/entrar'],
  ['sign-up', '/cadastro'],
  ['onboarding', '/boas-vindas'],
  ['familia-selector', '/familias'],
  ['dashboard', '/'],
  ['extrato', '/extrato'],
  ['lancamentos', '/planejar/contas'],
  ['orcamento', '/planejar/limites'],
  ['cofrinhos', '/planejar/cofrinhos'],
  ['configuracoes', '/mais'],
  ['relatorios', '/mais/relatorios'],
  ['historico', '/mais/historico'],
  ['family-settings', '/mais/familia'],
  ['categorias', '/mais/categorias'],
  ['metodos-pagamento', '/mais/metodos-pagamento'],
  ['perfil', '/mais/perfil'],
  ['ajuda', '/mais/ajuda'],
];

describe('caminhos > mapa de endereços', () => {
  it.each(TELAS_SEM_PARAMETRO)('a tela %s fica em %s', (tela, caminho) => {
    expect(caminhoDaTela(tela)).toBe(caminho);
  });

  it.each(TELAS_SEM_PARAMETRO)('o endereço de %s volta para a tela %s', (tela, caminho) => {
    expect(telaDoCaminho(caminho)).toBe(tela);
  });

  it('expõe um endereço constante por tela sem parâmetro', () => {
    expect(CAMINHOS).toMatchObject({
      entrar: '/entrar',
      cadastro: '/cadastro',
      boasVindas: '/boas-vindas',
      familias: '/familias',
      inicio: '/',
      extrato: '/extrato',
      planejar: '/planejar',
      contas: '/planejar/contas',
      limites: '/planejar/limites',
      cofrinhos: '/planejar/cofrinhos',
      mais: '/mais',
      relatorios: '/mais/relatorios',
      historico: '/mais/historico',
      familia: '/mais/familia',
      categorias: '/mais/categorias',
      metodosPagamento: '/mais/metodos-pagamento',
      perfil: '/mais/perfil',
      ajuda: '/mais/ajuda',
    });
  });

  it('monta o endereço do detalhe do cofrinho', () => {
    expect(caminhoDoCofrinho('abc')).toBe('/planejar/cofrinhos/abc');
  });

  it('monta o endereço da fatura com o mês', () => {
    expect(caminhoDaFatura('m1', '2026-11')).toBe('/planejar/fatura/m1?mes=2026-11');
  });

  it('endereços sob cofrinhos e fatura voltam para as telas de detalhe', () => {
    expect(telaDoCaminho('/planejar/cofrinhos/abc')).toBe('cofrinho-detalhe');
    expect(telaDoCaminho('/planejar/fatura/m1')).toBe('fatura');
  });

  it('identificador de tela desconhecido cai no início', () => {
    expect(caminhoDaTela('nao-existe')).toBe(CAMINHOS.inicio);
  });

  it('endereço desconhecido cai no dashboard', () => {
    expect(telaDoCaminho('/nao-existe')).toBe('dashboard');
  });
});

describe('abaDoCaminho', () => {
  it.each([
    ['/', 'inicio'],
    ['/extrato', 'extrato'],
    ['/planejar', 'planejar'],
    ['/planejar/contas', 'planejar'],
    ['/planejar/limites', 'planejar'],
    ['/planejar/cofrinhos', 'planejar'],
    ['/planejar/cofrinhos/c1', 'planejar'],
    ['/planejar/fatura/m1', 'planejar'],
    ['/mais', 'mais'],
    ['/mais/relatorios', 'mais'],
    ['/mais/historico', 'mais'],
    ['/mais/familia', 'mais'],
    ['/mais/categorias', 'mais'],
    ['/mais/metodos-pagamento', 'mais'],
    ['/mais/perfil', 'mais'],
    ['/mais/ajuda', 'mais'],
    ['/qualquer-coisa', 'inicio'],
  ])('%s marca a aba %s', (caminho, aba) => {
    expect(abaDoCaminho(caminho)).toBe(aba);
  });

  it('não confunde um prefixo parecido com a aba', () => {
    expect(abaDoCaminho('/maisquerido')).toBe('inicio');
    expect(abaDoCaminho('/planejarx')).toBe('inicio');
  });
});
