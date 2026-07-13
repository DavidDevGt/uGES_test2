import { test, expect } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { deleteQuizIfExists, setQuizClose } from '../fixtures/moodle-cli';
import { QuizSettingsPage } from '../pages/QuizSettingsPage';
import { QuizEditPage } from '../pages/QuizEditPage';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';

/**
 * Flujos 1 y 4 (SPECS §4.3):
 *  1 — crear/configurar examen: timing, intentos, método de calificación PERSISTEN
 *      al reabrir settings (assert contra el form recargado, no contra el submit).
 *  4 — opciones de revisión: "respuesta correcta" oculta hasta el cierre → el
 *      estudiante NO la ve tras enviar; tras cerrar el quiz, SÍ.
 *
 * Quiz propio creado por UI ('quiz-e2e-config'); borrado en beforeAll (idempotencia).
 */

const COURSE = TESTDATA.course.fullname;
const QUIZ = 'quiz-e2e-config';

test.describe.configure({ mode: 'serial' });

test.describe('flujos 1+4: configuración del examen y opciones de revisión', () => {
  test.use({ storageState: STORAGE.teacher });

  test.beforeAll(() => {
    deleteQuizIfExists(TESTDATA.course.shortname, QUIZ);
  });

  test('flujo 1: el quiz creado persiste timing, intentos y método al reabrir settings', async ({
    page,
  }) => {
    const settings = new QuizSettingsPage(page);
    await settings.startQuizCreation(COURSE);
    await settings.setName(QUIZ);
    await settings.expandAll();
    await settings.setTimeLimit(20);
    await settings.setAttemptsAllowed(3);
    await settings.setGradeMethod('Average grade');

    // Flujo 4 — parte de configuración: la respuesta correcta solo tras el cierre.
    // La columna "closed" solo persiste si el quiz TIENE timeclose (disabledIf del
    // mform: sin fecha de cierre, Moodle descarta esos checkboxes al guardar).
    await settings.setDateField('timeclose', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    await settings.setReviewOption('rightanswer', 'immediately', false);
    await settings.setReviewOption('rightanswer', 'open', false);
    await settings.setReviewOption('rightanswer', 'closed', true);
    await settings.save();

    // Assert real de persistencia: REABRIR el form y leer los valores guardados.
    await settings.openSettings(COURSE, QUIZ);
    await settings.expandAll();
    await expect(page.locator('#id_timelimit_number')).toHaveValue('20');
    await expect(page.locator('#id_attempts option:checked')).toHaveText('3');
    await expect(page.locator('#id_grademethod option:checked')).toHaveText('Average grade');
    await expect(page.locator('#id_rightanswerimmediately')).not.toBeChecked();
    await expect(page.locator('#id_rightanswerclosed')).toBeChecked();

    // Una pregunta para poder rendirlo (flujo 4).
    const edit = new QuizEditPage(page);
    await edit.open(COURSE, QUIZ);
    await edit.addNewTrueFalse('TF-config', '2 es par.', true);
    await expect(edit.slotByText('TF-config')).toBeVisible();
  });

  test('flujo 4: la respuesta correcta se oculta tras enviar y aparece al cerrar el quiz', async ({
    browser,
  }) => {
    const studentCtx = await newContextAs(browser, 'student1');
    try {
      const studentPage = await studentCtx.newPage();
      const attempt = new QuizAttemptPage(studentPage);
      await attempt.openQuiz(COURSE, QUIZ);
      await attempt.startAttempt();
      await attempt.answerTrueFalse(false); // incorrecta a propósito: si se filtrara la correcta, se vería
      await attempt.finishAndSubmit();

      // Quiz aún abierto: la revisión NO muestra la respuesta correcta.
      await expect(studentPage.locator('body')).not.toContainText('The correct answer is');

      // Cerrar el quiz (timeclose en el pasado) y recargar la revisión.
      setQuizClose(TESTDATA.course.shortname, QUIZ, Math.floor(Date.now() / 1000) - 60);
      await studentPage.reload();
      await attempt.waitForMoodleReady();

      // Ahora SÍ se muestra la respuesta correcta.
      await expect(studentPage.locator('body')).toContainText('The correct answer is');
    } finally {
      await studentCtx.close();
    }
  });
});
