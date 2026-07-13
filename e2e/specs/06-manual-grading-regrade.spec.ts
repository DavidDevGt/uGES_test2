import { test, expect } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { resetAttempts } from '../fixtures/reset';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';
import { GradingPage } from '../pages/GradingPage';
import { AttemptsReportPage } from '../pages/AttemptsReportPage';
import { GradebookPage } from '../pages/GradebookPage';

/**
 * Flujo 10 (SPECS §4.3): el profesor califica manualmente el ensayo y la nota
 * total del intento se actualiza; recalificar no la corrompe.
 *
 * Par de aislamiento: (quiz-general, student2).
 * Matemática determinista: ensayo respondido (pendiente) + MC correcta.
 *   Antes de calificar: "Not yet graded" (F17). Tras calificar el ensayo con
 *   0.75 → total 1.75 / 7.00 (MC 1.00 + ensayo 0.75).
 */

const PAIR = TESTDATA.attemptPairs.grading;
const COURSE = TESTDATA.course.fullname;
const STUDENT2_FULLNAME = 'Sara StudentTwo';
const ESSAY_MARK = '0.75';
const EXPECTED_TOTAL = '1.75';

test.describe.configure({ mode: 'serial' });

test.describe('flujo 10: calificación manual del ensayo y recalificación', () => {
  test.use({ storageState: STORAGE.student2 });

  test.beforeAll(() => {
    resetAttempts(PAIR.quiz, PAIR.user);
  });

  test('el intento con ensayo respondido queda pendiente de calificación manual', async ({ page }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt();

    // Página 1: ensayo (respondido → requiere calificación manual, F17).
    await attempt.answerEssay('La verificación construye bien el producto; la validación construye el producto correcto.');
    await attempt.nextPage();

    // MC correcta para tener una parte auto-calificada determinista.
    await attempt.jumpToQuestion(3);
    await attempt.answerMultichoice(TESTDATA.questions.multichoice.correct);
    await attempt.nextPage();
    await attempt.finishAndSubmit();

    await expect(attempt.reviewSummary).toContainText('Finished');
    await expect(attempt.reviewSummary).toContainText('Not yet graded');
  });

  test('el profesor califica el ensayo y la nota total del intento se actualiza', async ({
    page,
    browser,
  }) => {
    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const grading = new GradingPage(await teacherCtx.newPage());
      await grading.open(COURSE, PAIR.quiz);
      await grading.openGradingFor(TESTDATA.questions.essay.name);
      await grading.gradeVisibleAnswer(ESSAY_MARK, 'Buen intento: cubre ambos conceptos.');

      // La nota total se refleja en el gradebook (assert por capa).
      const gradebook = new GradebookPage(grading.page);
      await gradebook.open(COURSE);
      await expect(gradebook.studentRow(STUDENT2_FULLNAME)).toContainText(EXPECTED_TOTAL);
    } finally {
      await teacherCtx.close();
    }

    // Y el estudiante la ve en su revisión.
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await page.getByRole('link', { name: 'Review' }).first().click();
    await attempt.waitForMoodleReady();
    await expect(attempt.reviewSummary).toContainText(`${EXPECTED_TOTAL} out of 7.00`);
  });

  test('recalificar el intento no corrompe la nota manual', async ({ page, browser }) => {
    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const report = new AttemptsReportPage(await teacherCtx.newPage());
      await report.open(COURSE, PAIR.quiz);
      await report.regradeAttemptOf(STUDENT2_FULLNAME);
      await expect(report.attemptRow(STUDENT2_FULLNAME)).toContainText(EXPECTED_TOTAL);
    } finally {
      await teacherCtx.close();
    }

    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await page.getByRole('link', { name: 'Review' }).first().click();
    await attempt.waitForMoodleReady();
    await expect(attempt.reviewSummary).toContainText(`${EXPECTED_TOTAL} out of 7.00`);
  });
});
