import metricsPlugin from 'fastify-metrics';
import fp from 'fastify-plugin';

/**
 * Expõe GET /metrics no formato Prometheus.
 * - Métricas default do prom-client (process_*, nodejs_*).
 * - Histograma http_request_duration_seconds por método/rota/status.
 * - Sem labels de alta cardinalidade: usa o template da rota (ex: /api/transacoes/:id),
 *   nunca familia_id/user_id. /metrics fica na raiz, sem prefixo /api.
 */
export const metricsPlugin_ = fp(async (app) => {
  await app.register(metricsPlugin, {
    endpoint: '/metrics',
    // Limpa o registry global do prom-client antes de registrar. Evita o erro
    // "metric already registered" quando buildApp() é instanciado mais de uma vez
    // no mesmo processo (ex.: várias suítes de teste). Em produção há uma única
    // instância da app, então o clear é inofensivo.
    clearRegisterOnInit: true,
    routeMetrics: {
      enabled: true,
      // Agrupa por template de rota (definido pelo schema Fastify), evitando
      // explosão de séries por URLs com UUIDs.
      groupStatusCodes: true,
      registeredRoutesOnly: true,
      overrides: {
        histogram: {
          name: 'http_request_duration_seconds',
          help: 'Duração das requests HTTP em segundos',
          buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2.5, 5, 10],
        },
      },
    },
  });
});
