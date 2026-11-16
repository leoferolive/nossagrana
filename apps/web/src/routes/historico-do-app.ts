/**
 * Diz se existe uma entrada anterior do app no histórico, para o "Voltar" da tela decidir
 * entre voltar uma entrada e ir à origem do mapa.
 *
 * A `key` da location não basta: `replace` (o redirecionamento para o endereço pedido depois do
 * login, por exemplo) troca a key da primeira entrada, e ela deixa de ser "default" sem que haja
 * tela anterior. O `BrowserRouter` grava `idx` em `window.history.state`, que continua 0 na
 * primeira entrada do app mesmo substituída. Sem `idx` (o `MemoryRouter` dos testes), vale a key.
 */
export const temEntradaAnteriorDoApp = (key: string): boolean => {
  const estado: unknown = window.history.state;
  if (typeof estado === 'object' && estado !== null && 'idx' in estado) {
    const { idx } = estado;
    if (typeof idx === 'number') return idx > 0;
  }
  return key !== 'default';
};
