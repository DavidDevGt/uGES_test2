import { test, expect } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { resetAttempts } from '../fixtures/reset';
import { getUserId } from '../fixtures/moodle-cli';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';
import { AttemptsReportPage } from '../pages/AttemptsReportPage';
import { GradebookPage } from '../pages/GradebookPage';

/**
 * Flujo 11 (SPECS §4.3): override de notas visible en gradebook + el reporte de
 * intentos lista los intentos con sus estados.
 *
 * Par de aislamiento: (quiz-autosubmit, student2) — celda del gradebook que ningún
 * otro spec aserta. El override se REVIERTE al final del test (auto-limpieza:
 * un override persistente rompería la repetibilidad de otros asserts).
 */

const PAIR = TESTDATA.attemptPairs.reports;
const COURSE = TESTDATA.course.fullname;
const QUIZ = TESTDATA.quizzes.autosubmit.name;
const STUDENT_FULLNAME = 'Sasha StudentFour'; // par de aislamiento reports = student4
const OVERRIDE_GRADE = '1.50';

test.describe.configure({ mode: 'serial' });

test.describe('flujo 11: overrides de nota y reportes del examen', () => {
  test.use({ storageState: STORAGE.student4 });

  // teacher2 (editor dedicado) hace el override: el "Edit mode" del gradebook es
  // una preferencia de servidor por-usuario y no debe compartirse con los specs
  // que solo LEEN el gradebook como teacher (06/10) — evita la carrera F21.

  test.beforeAll(() => {
    resetAttempts(PAIR.quiz, PAIR.user);
  });

  test('el reporte de intentos lista el intento con su estado', async ({ page, browser }) => {
    // Intento mínimo: entrar y enviar sin responder (rápido y determinista: 0.00).
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt();
    await attempt.finishAndSubmit();

    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const report = new AttemptsReportPage(await teacherCtx.newPage());
      await report.open(COURSE, QUIZ);
      const row = report.attemptRow(STUDENT_FULLNAME);
      await expect(row).toContainText('Finished');
      await expect(report.reviewLink(STUDENT_FULLNAME)).toBeVisible();
    } finally {
      await teacherCtx.close();
    }
  });

  test('override de nota visible en gradebook, y reversible', async ({ browser }) => {
    test.slow();

    const userId = getUserId(PAIR.user);
    const teacherCtx = await newContextAs(browser, 'teacher2');
    try {
      const gradebook = new GradebookPage(await teacherCtx.newPage());

      // Aplicar el override en Single view (modo edición: inputs override_*/finalgrade_*).
      await gradebook.openSingleViewForUser(COURSE, userId);
      await gradebook.overrideCheckbox(QUIZ).check();
      await gradebook.gradeInput(QUIZ).fill(OVERRIDE_GRADE);
      await gradebook.saveSingleView();

      // El grader report refleja la nota sobreescrita.
      await gradebook.open(COURSE);
      await expect(gradebook.studentRow(STUDENT_FULLNAME)).toContainText(OVERRIDE_GRADE);

      // Revertir (auto-limpieza para repetibilidad).
      await gradebook.openSingleViewForUser(COURSE, userId);
      await gradebook.overrideCheckbox(QUIZ).uncheck();
      await gradebook.saveSingleView();

      await gradebook.open(COURSE);
      await expect(gradebook.studentRow(STUDENT_FULLNAME)).not.toContainText(OVERRIDE_GRADE);
    } finally {
      await teacherCtx.close();
    }
  });
});
