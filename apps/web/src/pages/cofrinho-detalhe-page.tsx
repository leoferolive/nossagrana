interface CofrinhoDetalhePageProps {
  familiaId: string;
  cofrinhoId: string;
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export function CofrinhoDetalhePage({ cofrinhoId }: CofrinhoDetalhePageProps) {
  return <div>Cofrinho Detalhe - {cofrinhoId}</div>;
}
