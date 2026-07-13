import { execSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

/** Ejecuta un subcomando de scripts/e2e-helpers.php dentro del contenedor. */
function helper(args: string[]): string {
  execSync('docker compose cp scripts/e2e-helpers.php moodle:/tmp/e2e-helpers.php', {
    cwd: ROOT,
    stdio: 'pipe',
    timeout: 60_000,
  });
  return execSync(
    `docker compose exec -T moodle php /tmp/e2e-helpers.php ${args.map((a) => `"${a}"`).join(' ')}`,
    { cwd: ROOT, stdio: 'pipe', timeout: 120_000 },
  )
    .toString()
    .trim();
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
