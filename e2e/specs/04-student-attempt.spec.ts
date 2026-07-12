import { test, expect } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { resetAttempts } from '../fixtures/reset';
import { QuizAttemptPage } from '../pages/QuizAttemptPage';
import { GradebookPage } from '../pages/GradebookPage';

/**
 * Flujos 6, 8 y 9 (SPECS §4.3) sobre quiz-general.
 *
 * Un solo viaje serial: iniciar/responder/navegar/marcar → enviar → verificar
 * calificación automática EXACTA. El estado vive en el servidor (el intento),
 * así que los 3 tests comparten el par (quiz-general, student1) — aislado del
 * resto de la suite por la matriz attemptPairs + reset en beforeAll.
 *
 * Respuestas conocidas y nota esperada (cada pregunta vale 1, máx 7):
 *   ESSAY SIN RESPONDER = 0 (si se responde, Moodle retiene la nota del intento
 *   completo como "Not yet graded" hasta calificación manual — comportamiento real
 *   verificado; responder el ensayo pertenece al flujo 10, spec 06, con otro usuario)
 *   MATCH correcta = 1 · MC correcta = 1 · NUM correcta = 1
 *   SA INCORRECTA deliberada = 0 · TF correcta = 1 · aleatoria sin responder = 0
 *   → sumgrades esperado: 4.00 / 7.00
 */

const PAIR = TESTDATA.attemptPairs.studentFlows;
const COURSE = TESTDATA.course.fullname;
const Q = TESTDATA.questions;
const EXPECTED_GRADE = '4.00';

test.describe.configure({ mode: 'serial' });

test.describe('flujos 6+8+9: ciclo completo del intento del estudiante', () => {
  test.use({ storageState: STORAGE.student1 });

  test.beforeAll(() => {
    resetAttempts(PAIR.quiz, PAIR.user);
  });

  test('flujo 6: inicia, responde por tipo, navega y marca para revisar', async ({ page }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    await attempt.startAttempt();

    // Orden de slots = orden de inserción del seed (alfabético por nombre) + aleatoria al final.
    // Página 1: SEED-ESSAY-01 — se verifica que renderiza pero NO se responde (ver cabecera).
    await expect(attempt.question()).toContainText('validación y verificación');
    await attempt.nextPage();

    // Página 2: SEED-MATCH-01 (todas correctas).
    await attempt.answerMatching(Q.matching.pairs);
    await attempt.nextPage();

    // Página 3: SEED-MC-01 (correcta).
    await attempt.answerMultichoice(Q.multichoice.correct);
    await attempt.nextPage();

    // Página 4: SEED-NUM-01 (correcta).
    await attempt.answerText(Q.numerical.correct);
    await attempt.nextPage();

    // Página 5: SEED-SA-01 — INCORRECTA deliberada (flujo 9 exige nota exacta con fallo conocido).
    await attempt.answerText('Barcelona');
    // Marcar para revisar: la marca debe reflejarse en el panel de navegación (assert real).
    await attempt.toggleFlag();
    await expect(attempt.navButton(5)).toHaveClass(/flagged/);

    // Navegación conserva respuestas: volver a la MC (página 3) y verificar que la
    // opción correcta sigue seleccionada (assert real de persistencia, no de render).
    await attempt.jumpToQuestion(3);
    await expect(
      attempt.question().getByRole('radio', { name: new RegExp(Q.multichoice.correct) }),
    ).toBeChecked();

    // Página 6: SEED-TF-01 (correcta). La aleatoria (página 7) queda sin responder.
    await attempt.jumpToQuestion(6);
    await attempt.answerTrueFalse(true);
    // Moodle persiste las respuestas AL NAVEGAR (submit del form de página); el
    // autosave corre cada 60s. Sin esta navegación, el TF se perdería al cerrar
    // la página (verificado: slot quedaba "gaveup" en BD).
    await attempt.nextPage();
  });

  test('flujo 8: envía el intento con confirmación y queda Finalizado con timestamp', async ({ page }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);
    // El intento del test anterior sigue inprogress: continuar y enviar.
    await attempt.startAttempt();
    await attempt.finishAndSubmit();

    // Tras el envío Moodle aterriza en la revisión: estado + timestamp de completado
    // (el label real en 4.5 es "Completed", no "Submitted" — verificado contra la tabla).
    await expect(attempt.reviewSummary).toContainText('Finished');
    await expect(attempt.reviewSummary).toContainText('Completed');
  });

  test('flujo 9: calificación automática exacta en revisión Y en gradebook', async ({ page, browser }) => {
    const attempt = new QuizAttemptPage(page);
    await attempt.openQuiz(COURSE, PAIR.quiz);

    // Vista del quiz: estado del intento + nota exacta según grademethod.
    await expect(attempt.attemptSummaryTable(1)).toContainText('Finished');
    await expect(attempt.finalGradeHeading).toContainText(`${EXPECTED_GRADE} / 7.00`);

    // Assert por capa (SPECS §4.2): el gradebook la refleja — vista del PROFESOR,
    // no solo la UI del quiz del estudiante.
    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const teacherPage = await teacherCtx.newPage();
      const gradebook = new GradebookPage(teacherPage);
      await gradebook.open(COURSE);
      await expect(gradebook.studentRow('Sam StudentOne')).toContainText(EXPECTED_GRADE);
    } finally {
      await teacherCtx.close();
    }
  });
});
