/**
 * Fake nomeada de `aplicarMigrations` que sempre falha, simulando uma
 * migration inválida (ex.: SQL com erro de sintaxe) no setup da fixture.
 */
export class MigradorQuebradoFake {
  constructor(private readonly tagDaMigration: string) {}

  readonly migrar = (_url: string): Promise<void> =>
    Promise.reject(new Error(`erro de sintaxe SQL na migration ${this.tagDaMigration}`));
}
