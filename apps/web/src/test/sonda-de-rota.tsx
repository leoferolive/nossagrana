import { useLocation, useNavigate } from 'react-router';

/**
 * Sonda de teste: expõe o endereço atual e um "voltar" do histórico, para os testes
 * afirmarem a navegação sem depender de `window.history` do jsdom. O nome do botão
 * evita a palavra "voltar", que os botões das páginas já usam.
 */
export const SondaDeRota = () => {
  const local = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output data-testid="sonda-local">{`${local.pathname}${local.search}`}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        Sonda: histórico para trás
      </button>
    </div>
  );
};
