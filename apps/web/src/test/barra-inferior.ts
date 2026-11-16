import { screen, within } from '@testing-library/react';

/** Consultas restritas à barra inferior, porque o menu lateral repete Início e Extrato como links. */
export const barraInferior = () =>
  within(screen.getByRole('navigation', { name: 'Navegação principal' }));
