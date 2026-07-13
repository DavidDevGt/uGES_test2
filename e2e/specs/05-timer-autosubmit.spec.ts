import { test, expect } from '@playwright/test';
import { STORAGE } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { resetAttempts } from '../fixtures/reset';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';

/**
 * Flujo 7: límite de tiempo y auto-envío al expirar (SPECS §4.3).
 * Corre en el proyecto "timed": el timer REAL es el sujeto de la prueba — la
 * espera de ~60s no es un sleep de sincronización, es el comportamiento bajo test.
 *
 * quiz-autosubmit: timelimit 60s + overduehandling=autosubmit (quiz propio: el
 * graceperiod de quiz-timed pertenece al Cambio 4 y los settings no se mutan
 * entre specs paralelos). Par de aislamiento: (quiz-autosubmit, student1).
 */

const PAIR = TESTDATA.attemptPairs.timer;
const COURSE = TESTDATA.course.fullname;

test.describe('flujo 7: timer y auto-envío', () => {
  test.use({ storageState: STORAGE.student5 });

  test.beforeAll(() => {
    resetAttempts(PAIR.quiz, PAIR.user);
  });

  test('al expirar el tiempo, el intento queda Finished SIN acción del estudiante y la nota existe', async ({
    page,
  }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt(); // confirma el pre-flight del límite de tiempo

    // El contador del quiz está corriendo (evidencia de que el timer aplica).
    await expect(attempt.timer).toBeVisible();

    // Responder la MC y navegar (la navegación persiste la respuesta — F16).
    await attempt.answerMultichoice(TESTDATA.questions.multichoice.correct);
    await attempt.nextPage();

    // NO se envía nada: el auto-submit de Moodle debe llevarnos solo a la revisión.
    await page.waitForURL(/\/mod\/quiz\/review\.php/, { timeout: 120_000 });

    // Assert real: estado Finished + nota calculada (1.00 de 2.00 por la MC correcta).
    await expect(attempt.reviewSummary).toContainText('Finished');
    await expect(attempt.reviewSummary).toContainText('1.00 out of 2.00');
  });
});
