import { test, expect, type Page } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { resetAttempts } from '../fixtures/reset';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';
import { AttemptsReportPage } from '../pages/AttemptsReportPage';

/**
 * Cambio 2 — local_focusguard. Criterios de aceptación SPECS §2.3.
 * Par de aislamiento: (quiz-general, student3) — exclusivo de este spec.
 *
 * Nota de diseño: cerrar la página del intento también cuenta como pérdida de
 * foco (visibilitychange→hidden al cerrar la pestaña — comportamiento correcto
 * del producto). Por eso los CONTEOS EXACTOS se verifican dentro de un único
 * test con la página del estudiante siempre abierta; los tests posteriores
 * asertan la semántica del criterio (marca visual presente/ausente).
 */

const PAIR = TESTDATA.attemptPairs.focusguard;
const COURSE = TESTDATA.course.fullname;
const STUDENT3_FULLNAME = 'Sofi StudentThree';

/** Responde solo la MC correcta → nota determinista 1.00 (para el criterio 5). */
async function answerOnlyMc(attempt: QuizAttemptPage): Promise<void> {
  await attempt.jumpToQuestion(3); // SEED-MC-01
  await attempt.answerMultichoice(TESTDATA.questions.multichoice.correct);
  await attempt.nextPage(); // navegar persiste la respuesta (F16)
}

/**
 * Dispara una pérdida de foco real (evento window.blur que escucha el módulo AMD)
 * y espera la respuesta del web service. El waitForTimeout es legítimo aquí: el
 * DEBOUNCE de 1s del módulo ES parte del comportamiento bajo prueba (SPECS §2.2).
 */
async function triggerBlur(page: Page): Promise<void> {
  const wsResponse = page.waitForResponse(
    (r) => r.url().includes('service.php') && r.url().includes('local_focusguard_report_blur'),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await wsResponse;
  await page.waitForTimeout(1200); // ventana de debounce del módulo
}

test.describe.configure({ mode: 'serial' });

test.describe('Cambio 2: señal de integridad por pérdida de foco', () => {
  test.use({ storageState: STORAGE.student3 });

  let attemptId = 0;

  test.beforeAll(() => {
    resetAttempts(PAIR.quiz, PAIR.user);
  });

  test('criterios 1+2+3: conteo exacto, persistencia tras recarga y marca al superar 3', async ({
    page,
    browser,
  }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt();
    attemptId = Number(page.url().match(/attempt=(\d+)/)?.[1] ?? 0);
    expect(attemptId).toBeGreaterThan(0);

    // 2 pérdidas de foco → conteo 2, SIN marca (la página del estudiante sigue abierta).
    await triggerBlur(page);
    await triggerBlur(page);

    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const report = new AttemptsReportPage(await teacherCtx.newPage());
      await report.open(COURSE, PAIR.quiz);
      const badge = report.focusBadge(STUDENT3_FULLNAME);
      await expect(badge).toHaveText('Focus: 2');
      await expect(badge).not.toHaveClass(/focusguard-alert/);

      // Recarga a mitad de examen: el conteo debe CONTINUAR desde 2, no reiniciarse.
      await page.reload();
      await attempt.waitForMoodleReady();
      await triggerBlur(page);
      await triggerBlur(page); // total: 4 (> umbral 3)

      await report.page.reload();
      await report.waitForMoodleReady();
      const badge4 = report.focusBadge(STUDENT3_FULLNAME);
      // Conteo EXACTO: tras el fix F19 del plugin (suprimir eventos de unload),
      // solo cuentan las pérdidas de foco reales — ni el reload ni las navegaciones.
      await expect(badge4).toHaveText('Focus: 4');
      await expect(badge4).toHaveClass(/focusguard-alert/);
    } finally {
      await teacherCtx.close();
    }
  });

  test('criterio 6: un estudiante NO puede reportar blur sobre un intento ajeno', async ({ browser }) => {
    // student1 intenta incrementar el conteo del intento de student3 llamando al WS directo.
    const intruderCtx = await newContextAs(browser, 'student1');
    try {
      const intruderPage = await intruderCtx.newPage();
      await intruderPage.goto('/my/');
      const result = await intruderPage.evaluate(async (foreignAttemptId) => {
        type MoodleWindow = Window & { M: { cfg: { sesskey: string } } };
        const sesskey = (window as unknown as MoodleWindow).M.cfg.sesskey;
        const resp = await fetch(
          `/lib/ajax/service.php?sesskey=${sesskey}&info=local_focusguard_report_blur`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([
              {
                index: 0,
                methodname: 'local_focusguard_report_blur',
                args: { attemptid: foreignAttemptId },
              },
            ]),
          },
        );
        return resp.json();
      }, attemptId);

      expect(result[0].error).toBeTruthy(); // el WS rechaza el intento ajeno
    } finally {
      await intruderCtx.close();
    }
  });

  test('criterios 4+5: intento sin blur muestra 0 sin marca, y la nota no cambia', async ({
    page,
    browser,
  }) => {
    // Cerrar el intento con blurs (respondiendo solo la MC → 1.00 determinista).
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt();
    await answerOnlyMc(attempt);
    await attempt.finishAndSubmit();

    // Segundo intento SIN pérdidas de foco, mismas respuestas.
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt();
    await answerOnlyMc(attempt);
    await attempt.finishAndSubmit();

    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const report = new AttemptsReportPage(await teacherCtx.newPage());
      await report.open(COURSE, PAIR.quiz);

      // Solo las filas de student3 (otras filas del reporte tienen sus propios conteos).
      const s3rows = report.page.locator('table#attempts tbody tr', {
        hasText: STUDENT3_FULLNAME,
      });
      await expect(s3rows).toHaveCount(2);

      // Intento con blurs: conserva su conteo exacto (4) con marca visual.
      const alertRow = s3rows.filter({ has: report.page.locator('.focusguard-alert') });
      const cleanRow = s3rows.filter({ has: report.page.locator('.focusguard-badge', { hasText: 'Focus: 0' }) });
      await expect(alertRow).toHaveCount(1);
      await expect(alertRow.locator('.focusguard-badge')).toHaveText('Focus: 4');
      await expect(cleanRow).toHaveCount(1);
      await expect(cleanRow.locator('.focusguard-badge')).not.toHaveClass(/focusguard-alert/);

      // Criterio 5 — misma nota (1.00) con y sin pérdidas de foco.
      await expect(alertRow).toContainText('1.00');
      await expect(cleanRow).toContainText('1.00');
    } finally {
      await teacherCtx.close();
    }
  });
});
