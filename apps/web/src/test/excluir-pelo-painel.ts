import { fireEvent, screen, within } from '@testing-library/react';

/** Exclui o lançamento aberto no painel: "Mais opções", "Excluir lançamento" e a confirmação. */
export const excluirPeloPainel = async (): Promise<void> => {
  const mais = screen.getByRole('button', { name: 'Descrição, parcelas e repetição' });
  if (mais.getAttribute('aria-expanded') !== 'true') fireEvent.click(mais);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }));
  const confirmacao = await screen.findByRole('dialog', { name: 'Excluir lançamento?' });
  fireEvent.click(within(confirmacao).getByRole('button', { name: 'Excluir' }));
};
