import { test, expect } from '@playwright/test';
import { STORAGE } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';
import { deleteQuizIfExists, deleteQuestionsByPrefix } from '../fixtures/moodle-cli';
import { QuestionBankPage } from '../pages/QuestionBankPage';
import { QuizSettingsPage } from '../pages/QuizSettingsPage';
import { QuizEditPage } from '../pages/QuizEditPage';

/**
 * Flujos 2 y 3 (SPECS §4.3):
 *  2 — crear por UI una pregunta de cada tipo requerido; cada una aparece listada.
 *  3 — agregar preguntas al examen: del banco y aleatorias.
 *
 * Las preguntas E2E-* y el quiz 'quiz-e2e-bank' se limpian en beforeAll (idempotencia).
 */

const COURSE = TESTDATA.course.fullname;
const QUIZ = 'quiz-e2e-bank';

test.describe.configure({ mode: 'serial' });

test.describe('flujos 2+3: banco de preguntas y armado del examen', () => {
  test.use({ storageState: STORAGE.teacher });

  test.beforeAll(() => {
    deleteQuizIfExists(TESTDATA.course.shortname, QUIZ);
    deleteQuestionsByPrefix('E2E-');
  });

  test('flujo 2: se crea una pregunta de cada tipo y aparece listada', async ({ page }) => {
    const bank = new QuestionBankPage(page);
    await bank.openFromCourse(COURSE);

    await bank.createMultichoice('E2E-MC-01', '¿Capital de Guatemala?', 'Ciudad de Guatemala', [
      'Antigua',
      'Quetzaltenango',
    ]);
    await bank.createTrueFalse('E2E-TF-01', 'El sol sale por el este.', true);
    await bank.createShortAnswer('E2E-SA-01', 'Capital de Honduras (una palabra):', 'Tegucigalpa');
    await bank.createNumerical('E2E-NUM-01', '¿Cuánto es 9 × 9?', '81');
    await bank.createMatching('E2E-MATCH-01', 'Empareja país y moneda.', [
      { item: 'Guatemala', match: 'Quetzal' },
      { item: 'México', match: 'Peso' },
      { item: 'Japón', match: 'Yen' },
    ]);
    await bank.createEssay('E2E-ESSAY-01', 'Describe el ciclo de vida de un defecto.');

    for (const name of ['E2E-MC-01', 'E2E-TF-01', 'E2E-SA-01', 'E2E-NUM-01', 'E2E-MATCH-01', 'E2E-ESSAY-01']) {
      await expect(bank.questionRow(name)).toBeVisible();
    }
  });

  test('flujo 3: el examen recibe preguntas del banco y una aleatoria', async ({ page }) => {
    const settings = new QuizSettingsPage(page);
    await settings.startQuizCreation(COURSE);
    await settings.setName(QUIZ);
    await settings.save();

    const edit = new QuizEditPage(page);
    await edit.open(COURSE, QUIZ);
    await edit.addFromBank('E2E-MC-01');
    await edit.addRandom();

    await expect(edit.slotByText('E2E-MC-01')).toBeVisible();
    await expect(edit.slotByText(/Random/)).toBeVisible();
  });
});
