import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

describe('GET /metrics (Prometheus)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 com payload no formato Prometheus', async () => {
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
    // Métricas default do prom-client (process_*) e histograma de request HTTP.
    expect(response.body).toContain('process_cpu_user_seconds_total');
    expect(response.body).toMatch(/# TYPE .* histogram/);
  });

  it('contém o histograma de duração de request HTTP após uma chamada', async () => {
    // Gera tráfego para popular o histograma por rota/método/status.
    await app.inject({ method: 'GET', url: '/api/health' });

    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.body).toContain('http_request_duration_seconds');
  });

  it('NÃO expõe labels de alta cardinalidade (familia_id / user_id)', async () => {
    await app.inject({ method: 'GET', url: '/api/health' });
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.body).not.toMatch(/familia_id=/);
    expect(response.body).not.toMatch(/user_id=/);
  });
});
