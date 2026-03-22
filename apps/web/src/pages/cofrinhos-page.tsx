interface CofrinhosPageProps {
  familiaId: string;
  onNavigate: (screen: string) => void;
  onVerDetalhe: (cofrinhoId: string) => void;
}

export function CofrinhosPage({ familiaId }: CofrinhosPageProps) {
  return <div>Cofrinhos Page - {familiaId}</div>;
}
