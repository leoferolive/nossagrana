import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  // Um worker e sem paralelismo: o limite de requisições da API (3 cadastros e 5 logins por
  // minuto por IP) é por IP, não por worker. Ver helpers/ritmo.ts e README.md.
  workers: 1,
  fullyParallel: false,
  // Sem nova tentativa: refazer um teste cadastra outro usuário e gasta mais uma vaga do limite.
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      // O app é celular primeiro (390x844). Nessa largura a barra inferior é a navegação; no
      // desktop ela some, o título da aba vai para a TopBar e os testes não achariam o "Lançar".
      // Sem `hasTouch`: com toque, o "+" trataria o clique como início de toque longo (voz).
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
});
