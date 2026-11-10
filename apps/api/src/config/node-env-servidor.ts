const NODE_ENVS_DO_SERVIDOR = ['development', 'production'];

/**
 * Impede o entrypoint de produção de subir com `NODE_ENV=test` (#79): esse valor
 * ativa repositórios InMemory e logger desligado, nunca válidos num servidor real.
 * Os testes usam `buildApp()` diretamente e não passam por aqui.
 */
export function assertNodeEnvDoServidor(nodeEnv: string): void {
  if (NODE_ENVS_DO_SERVIDOR.includes(nodeEnv)) return;
  throw new Error(
    `NODE_ENV inválido para o servidor: recebido "${nodeEnv}", esperado ${NODE_ENVS_DO_SERVIDOR.join('|')}`,
  );
}
