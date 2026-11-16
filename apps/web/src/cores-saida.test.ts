import { describe, expect, it } from 'vitest';

// Decisão 9 da nova UI: verde é a única cor de ação; vermelho só para alerta e exclusão;
// saída em texto neutro, entrada em verde.
const fontes = import.meta.glob<string>(['./components/**/*.tsx', './pages/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

function fonte(caminho: string): string {
  const conteudo = fontes[caminho];
  if (conteudo === undefined) throw new Error(`Arquivo ${caminho} não encontrado`);
  return conteudo;
}

describe('cores de saída e de ação', () => {
  it.each([
    './pages/extrato-page.tsx',
    './pages/historico-page.tsx',
    './pages/relatorios-page.tsx',
    './pages/cofrinho-detalhe-page.tsx',
    './components/lancamentos-resumo.tsx',
  ])('%s: valor de despesa não é vermelho', (caminho) => {
    const conteudo = fonte(caminho);
    expect(conteudo).not.toMatch(/'text-success' : 'text-danger'\s*\}?\s*`?\}?[^\n]*tipo/);
    expect(conteudo).not.toMatch(/tipo === 'receita' \? 'text-success' : 'text-danger'/);
    expect(conteudo).not.toMatch(/text-danger[^\n]*>\s*-?\{?formatBRL\((mes\.)?totalDespesas/);
    expect(conteudo).not.toMatch(/isAporte \? 'text-success' : 'text-danger'/);
    expect(conteudo).not.toMatch(/font-bold text-danger tabular-nums/);
    expect(conteudo).not.toMatch(/text-danger">\{?formatBRL\((cat|item|despesas)/);
  });

  it.each([
    './pages/dashboard-page.tsx',
    './pages/relatorios-page.tsx',
    './pages/historico-page.tsx',
  ])('%s: rótulos "Despesas" e "Saldo" são neutros', (caminho) => {
    const conteudo = fonte(caminho);
    expect(conteudo).not.toMatch(/text-danger[^>]*>\s*Despesas/);
    expect(conteudo).not.toMatch(/text-primary[^>]*>\s*Saldo/);
    expect(conteudo).not.toContain('border-danger bg-panel');
    expect(conteudo).not.toContain('border-primary bg-panel');
  });

  it('Retirar não é âmbar cheio, na tela do cofrinho nem no modal', () => {
    expect(fonte('./pages/cofrinho-detalhe-page.tsx')).not.toContain('bg-warning ');
    expect(fonte('./components/cofrinho-retirada-modal.tsx')).not.toContain('bg-warning ');
  });

  it('"Ver fatura" e "Gerar código de convite" usam o verde de ação, não o azul', () => {
    expect(fonte('./pages/metodos-pagamento-page.tsx')).not.toContain('hover:bg-info/10');
    expect(fonte('./pages/family-settings-page.tsx')).not.toContain('hover:border-info');
  });

  it('filtros do Extrato selecionados usam fundo success', () => {
    const conteudo = fonte('./pages/extrato-page.tsx');
    expect(conteudo).not.toContain("'bg-text text-bg'");
    expect(conteudo).not.toContain("'bg-danger text-white'");
  });
});
