import { test, expect } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { deleteQuizIfExists } from '../fixtures/moodle-cli';
import { QuizSettingsPage } from '../pages/QuizSettingsPage';
import { QuizEditPage } from '../pages/QuizEditPage';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';

/**
 * Flujo 12 (SPECS §4.3): restricciones de acceso — contraseña y ventana de fechas.
 * Quiz propio creado por UI ('quiz-restricted'): mutar restricciones en los quizzes
 * sembrados rompería a los specs paralelos. beforeAll lo borra (idempotencia).
 */

const COURSE = TESTDATA.course.fullname;
const QUIZ = 'quiz-restricted';
const PASSWORD = 'Secreto123!';

test.describe.configure({ mode: 'serial' });

test.describe('flujo 12: restricciones de acceso al examen', () => {
  test.use({ storageState: STORAGE.teacher });

  test.beforeAll(() => {
    deleteQuizIfExists(TESTDATA.course.shortname, QUIZ);
  });

  test('el profesor crea el quiz con contraseña y una pregunta', async ({ page }) => {
    const settings = new QuizSettingsPage(page);
    await settings.startQuizCreation(COURSE);
    await settings.setName(QUIZ);
    await settings.expandAll();
    await settings.setPassword(PASSWORD);
    await settings.save();

    const edit = new QuizEditPage(page);
    await edit.open(COURSE, QUIZ);
    await edit.addNewTrueFalse('TF-restricted', 'El agua moja.', true);
    await expect(edit.slotByText('TF-restricted')).toBeVisible();
  });

  test('sin contraseña (o incorrecta) NO se puede iniciar; con contraseña sí', async ({ browser }) => {
    const studentCtx = await newContextAs(browser, 'student1');
    try {
      const page = await studentCtx.newPage();
      const attempt = new QuizAttemptPage(page);
      await attempt.openQuiz(COURSE, QUIZ);
      await attempt.attemptButton.click();

      // Pre-flight con contraseña incorrecta: rechazado, sin entrar al intento
      // (el prompt de password vuelve a aparecer y la URL nunca llega a attempt.php).
      await attempt.fillPreflightPassword('incorrecta');
      await page.getByRole('button', { name: 'Start attempt' }).click();
      // El rechazo re-muestra el pre-flight (el input vuelve enmascarado d-none:
      // se aserta el wrapper del widget) y jamás se llega a attempt.php.
      await expect(
        page.locator('div[data-passwordunmask="wrapper"][data-passwordunmaskid="id_quizpassword"]').first(),
      ).toBeVisible();
      expect(page.url()).not.toContain('/mod/quiz/attempt.php');

      // Con la contraseña correcta: llenar + arrancar verificando por outcome
      // (reintenta el par si el widget passwordunmask pierde la carrera de render).
      await attempt.startAttemptWithPassword(PASSWORD);
      await expect(page).toHaveURL(/\/mod\/quiz\/attempt\.php/);
      await expect(attempt.question()).toBeVisible();

      // Cerrar el intento para dejar estado limpio.
      await attempt.answerTrueFalse(true);
      await attempt.finishAndSubmit();
    } finally {
      await studentCtx.close();
    }
  });

  test('fuera de la ventana de fechas el intento no está disponible', async ({ page, browser }) => {
    // El profesor abre el quiz a partir de mañana.
    const settings = new QuizSettingsPage(page);
    await settings.openSettings(COURSE, QUIZ);
    await settings.expandAll();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await settings.setDateField('timeopen', tomorrow);
    await settings.save();

    const studentCtx = await newContextAs(browser, 'student1');
    try {
      const studentPage = await studentCtx.newPage();
      const attempt = new QuizAttemptPage(studentPage);
      await attempt.openQuiz(COURSE, QUIZ);

      // Sin botón de intento y con el aviso de apertura futura ("Opens: <fecha>" en 4.5).
      await expect(attempt.attemptButton).toHaveCount(0);
      await expect(studentPage.locator('body')).toContainText(/Opens:|will open|not currently available/i);
    } finally {
      await studentCtx.close();
    }
  });
});
