/**
 * Fake nomeada do relógio: `agora()` só anda quando o teste manda (`avancar`),
 * o que torna determinísticos os testes de TTL (F.I.R.S.T.: repeatable).
 */
export class RelogioFake {
  constructor(private instante: Date = new Date('2026-09-30T12:00:00.000Z')) {}

  agora = (): Date => new Date(this.instante.getTime());

  avancar(ms: number): void {
    this.instante = new Date(this.instante.getTime() + ms);
  }
}
