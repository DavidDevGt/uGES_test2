import { test, expect } from '@playwright/test';
import { STORAGE } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';
import { AttemptsReportPage } from '../pages/AttemptsReportPage';

/**
 * Flujo 5 (SPECS §4.3): el profesor completa una vista previa y ve el resultado
 * SIN generar un intento de estudiante. Los previews del profesor no colisionan
 * con los intentos de estudiantes en quiz-general (Moodle los aísla por diseño).
 */

const COURSE = TESTDATA.course.fullname;
const QUIZ = TESTDATA.quizzes.general.name;
const TEACHER_FULLNAME = 'Tina Teacher';

test.describe('flujo 5: vista previa del examen como profesor', () => {
  test.use({ storageState: STORAGE.teacher });

  test('el profesor previsualiza, responde y ve resultado sin crear intento de estudiante', async ({
    page,
  }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, QUIZ);
    await attempt.startAttempt(); // botón "Preview quiz"

    // Responde la MC y termina la preview.
    await attempt.jumpToQuestion(3);
    await attempt.answerMultichoice(TESTDATA.questions.multichoice.correct);
    await attempt.nextPage();
    await attempt.finishAndSubmit();

    // Ve el resultado de su preview.
    await expect(attempt.reviewSummary).toContainText('Finished');

    // La preview NO aparece como intento en el reporte del profesor.
    // El overview de quiz-general es compartido: filtrar a la fila del profesor
    // (que debe ser 0) es robusto ante intentos de estudiantes de otros specs.
    const report = new AttemptsReportPage(page);
    await report.open(COURSE, QUIZ);
    //await expect(report.page.locator('table#attempts')).toBeVisible();
    await expect(report.attemptRow(TEACHER_FULLNAME)).toHaveCount(0);
  });
});
