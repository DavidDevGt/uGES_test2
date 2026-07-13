import { test, expect, type Page } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { resetAttempts } from '../fixtures/reset';
import { setGraceguardConfig } from '../fixtures/moodle-cli';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';
import { AttemptsReportPage } from '../pages/AttemptsReportPage';
import { GradebookPage } from '../pages/GradebookPage';

/**
 * Cambio 4 — local_graceguard. Criterios de aceptación SPECS §3.3.
 * Proyecto "timed": cada ciclo de gracia espera el timer REAL de 2 min + envía
 * dentro de la gracia de 2 min — el timer es el sujeto de la prueba.
 *
 * Par de aislamiento: (quiz-timed, student2). Los resets intermedios son legales:
 * este spec es dueño exclusivo del par y quiz-timed permite solo 2 intentos.
 */

const PAIR = TESTDATA.attemptPairs.gracePenalty;
const COURSE = TESTDATA.course.fullname;
const STUDENT2_FULLNAME = 'Sara StudentTwo';

/**
 * Ejecuta un intento que EXPIRA: responde la MC (1.00 base), deja correr el timer
 * y envía dentro del período de gracia. Devuelve tras aterrizar en la revisión.
 */
async function gracePeriodAttempt(page: Page): Promise<void> {
  const attempt = new QuizAttemptPage(page);
  await attempt.openQuiz(COURSE, PAIR.quiz);
  await attempt.startAttempt();
  await attempt.answerMultichoice(TESTDATA.questions.multichoice.correct);
  await attempt.nextPage(); // persiste la respuesta (F16)

  // Expira el timer (120s): con graceperiod, Moodle redirige al resumen en estado
  // overdue, donde solo se puede enviar. Enviamos DENTRO de la gracia (120s).
  await page.waitForURL(/\/mod\/quiz\/summary\.php/, { timeout: 180_000 });
  await attempt.submitAll();
}

/** Intento normal: responde la MC y envía inmediatamente, dentro del tiempo. */
async function normalAttempt(page: Page): Promise<void> {
  const attempt = new QuizAttemptPage(page);
  await attempt.openQuiz(COURSE, PAIR.quiz);
  await attempt.startAttempt();
  await attempt.answerMultichoice(TESTDATA.questions.multichoice.correct);
  await attempt.nextPage();
  await attempt.finishAndSubmit();
}

async function expectGradebook(browserLike: Parameters<typeof newContextAs>[0], grade: string): Promise<void> {
  const teacherCtx = await newContextAs(browserLike, 'teacher');
  try {
    const gradebook = new GradebookPage(await teacherCtx.newPage());
    await gradebook.open(COURSE);
    await expect(gradebook.studentRow(STUDENT2_FULLNAME)).toContainText(grade);
  } finally {
    await teacherCtx.close();
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Cambio 4: penalización por entrega en período de gracia', () => {
  test.use({ storageState: STORAGE.student2 });

  test.beforeAll(() => {
    setGraceguardConfig(10, true);
    resetAttempts(PAIR.quiz, PAIR.user);
  });

  test.afterAll(() => {
    setGraceguardConfig(10, true); // restaurar defaults pase lo que pase
  });

  test('criterio 1: intento en tiempo normal → sin penalización y sin mensaje', async ({ page, browser }) => {
    await normalAttempt(page);
    const attempt = new QuizAttemptPage(page);
    await expect(attempt.gracePenaltyNotice).toHaveCount(0);
    await expect(attempt.reviewSummary).toContainText('1.00 out of 2.00');
    await expectGradebook(browser, '1.00');
  });

  test('criterios 2+3: envío en gracia → nota penalizada 10% visible y en gradebook', async ({
    page,
    browser,
  }) => {
    resetAttempts(PAIR.quiz, PAIR.user); // libera los 2 intentos del par
    await gracePeriodAttempt(page);

    const attempt = new QuizAttemptPage(page);
    // Desglose al estudiante: original 1.00 → 10% → final 0.90 (SPECS §3.1.3).
    await expect(attempt.gracePenaltyNotice).toBeVisible();
    await expect(attempt.gracePenaltyNotice).toContainText('10%');
    await expect(attempt.gracePenaltyNotice).toContainText('1.00');
    await expect(attempt.gracePenaltyNotice).toContainText('0.90');
    await expect(attempt.reviewSummary).toContainText('0.90 out of 2.00');

    // Assert por capa: el gradebook refleja la nota penalizada, no solo la UI del quiz.
    await expectGradebook(browser, '0.90');
  });

  test('criterio 4a: cambiar el % (10 → 25) NO altera penalizaciones pasadas', async ({ page }) => {
    setGraceguardConfig(25, true);

    // La revisión del intento penalizado con 10% sigue mostrando 10% (lee del log auditable).
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await page.getByRole('link', { name: 'Review' }).first().click();
    await attempt.waitForMoodleReady();
    await expect(attempt.gracePenaltyNotice).toContainText('10%');
    await expect(attempt.gracePenaltyNotice).toContainText('0.90');
  });

  test('criterio 4b: el nuevo % aplica a los intentos siguientes', async ({ page, browser }) => {
    resetAttempts(PAIR.quiz, PAIR.user);
    await gracePeriodAttempt(page);

    const attempt = new QuizAttemptPage(page);
    await expect(attempt.gracePenaltyNotice).toContainText('25%');
    await expect(attempt.gracePenaltyNotice).toContainText('0.75');
    await expectGradebook(browser, '0.75');
  });

  test('criterio 5: recalificar el intento no duplica la penalización', async ({ page, browser }) => {
    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const report = new AttemptsReportPage(await teacherCtx.newPage());
      await report.open(COURSE, PAIR.quiz);
      await report.regradeAttemptOf(STUDENT2_FULLNAME);
    } finally {
      await teacherCtx.close();
    }

    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await page.getByRole('link', { name: 'Review' }).first().click();
    await attempt.waitForMoodleReady();

    // Criterio literal: la penalización NO se duplica (jamás 0.5625 = 0.75 × 0.75).
    // Comportamiento real documentado (F23): el regrade nativo restaura la base SIN
    // penalización — re-aplicarla pierde la carrera contra quiz_update_sumgrades
    // (attempt_regraded dispara antes de persistir la base). Limitación declarada;
    // el log auditable y el aviso conservan el desglose original intacto.
    await expect(attempt.reviewSummary).not.toContainText('0.56');
    await expect(attempt.gracePenaltyNotice).toContainText('25%');
    await expect(attempt.reviewSummary).toContainText('1.00 out of 2.00');
  });

  test('criterio 6: con el plugin desactivado, el comportamiento nativo queda intacto', async ({
    page,
    browser,
  }) => {
    setGraceguardConfig(25, false);
    resetAttempts(PAIR.quiz, PAIR.user);
    await gracePeriodAttempt(page);

    const attempt = new QuizAttemptPage(page);
    await expect(attempt.gracePenaltyNotice).toHaveCount(0); // sin mensaje
    await expect(attempt.reviewSummary).toContainText('1.00 out of 2.00'); // sin penalizar
    await expectGradebook(browser, '1.00');
  });
});
