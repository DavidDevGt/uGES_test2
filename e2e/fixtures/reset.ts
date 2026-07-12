import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Resetea los intentos de un (quiz, usuario) vía scripts/reset-attempts.sh.
 * Se invoca en beforeAll de cada spec que CONSUME intentos (auditoría C2):
 * garantiza repetibilidad (criterio explícito del enunciado) sin que un spec
 * borre los intentos en vuelo de otro par (quiz, usuario) corriendo en paralelo.
 */
export function resetAttempts(quizName: string, username: string): void {
  execSync(`bash scripts/reset-attempts.sh ${quizName} ${username}`, {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'pipe',
    timeout: 120_000,
  });
}
