import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Sleep bloqueante y cross-platform (sin depender de `sleep`, que no existe en Windows). */
function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * `docker compose exec` con reintento: bajo 3 workers concurrentes el exec
 * transita mal de forma intermitente (F24 — "Command failed" sin timeout). Tres
 * intentos con backoff corto lo vuelven determinista sin enmascarar errores reales
 * (un fallo persistente sigue lanzando tras el 3er intento).
 */
function execRetry(cmd: string, timeout: number, attempts = 3): string {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout }).toString().trim();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        sleepMs(1000 * (i + 1));
      }
    }
  }
  throw lastErr;
}

/** Ejecuta un subcomando de scripts/e2e-helpers.php dentro del contenedor. */
function helper(args: string[]): string {
  execRetry('docker compose cp scripts/e2e-helpers.php moodle:/tmp/e2e-helpers.php', 60_000);
  return execRetry(
    `docker compose exec -T moodle php /tmp/e2e-helpers.php ${args.map((a) => `"${a}"`).join(' ')}`,
    120_000,
  );
}

export function getUserId(username: string): number {
  return Number(helper(['userid', username]));
}

/** Configura local_graceguard (spec 10: cambios de % y toggle según §3.3). */
export function setGraceguardConfig(penaltyPct: number, enabled: boolean): void {
  helper(['set-graceguard', String(penaltyPct), enabled ? '1' : '0']);
}

/** Borra un quiz creado por un spec vía UI (idempotencia entre corridas). */
export function deleteQuizIfExists(courseShortname: string, quizName: string): void {
  helper(['delete-quiz', courseShortname, quizName]);
}

/** Cierra (o reabre con 0) un quiz por timeclose — flujo 4 (revisión tras cierre). */
export function setQuizClose(courseShortname: string, quizName: string, timecloseEpoch: number): void {
  helper(['close-quiz', courseShortname, quizName, String(timecloseEpoch)]);
}

/** Borra preguntas del banco creadas por specs vía UI (idempotencia entre corridas). */
export function deleteQuestionsByPrefix(prefix: string): void {
  helper(['delete-questions', prefix]);
}
