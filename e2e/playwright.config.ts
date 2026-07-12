import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import dotenv from 'dotenv';

// Nada hardcodeado: la suite lee el mismo .env que compose y seed.sh (SPECS §1.1).
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './specs',
  // Aislamiento (SPECS §4.2): cada spec resetea/crea sus intentos; ningún test depende de otro.
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0, // retry=1 solo en CI, con trace para diagnosticar (SPECS §4.2)
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 }, // Moodle bajo Docker no es instantáneo; web-first assertions absorben la latencia

  use: {
    baseURL: process.env.SITE_URL ?? 'http://localhost:8080',
    // Evidencia por corrida (SPECS §4.2): trace + video + screenshot solo cuando fallan.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Patrón moderno de auth (playwright.dev/docs/auth): proyecto setup que persiste
    // storageState por rol — reemplaza al global-setup.ts planeado originalmente porque
    // aparece en el reporte HTML con su propio trace (mejor evidencia de corrida).
    {
      name: 'setup',
      testDir: '.',
      testMatch: /auth\.setup\.ts/,
      fullyParallel: false, // Moodle puede dar "Invalid login" por locks de sesión/logintoken al recibir 4 logins paralelos
    },
    {
      name: 'core',
      dependencies: ['setup'],
      testIgnore: /05-timer|10-change4/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Los specs donde el timer real ES el sujeto de la prueba: sin paralelismo interno
      // y con presupuesto de tiempo propio (timer 2 min + gracia 1 min + margen).
      name: 'timed',
      dependencies: ['setup'],
      testMatch: /05-timer|10-change4/,
      fullyParallel: false,
      timeout: 5 * 60_000,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
