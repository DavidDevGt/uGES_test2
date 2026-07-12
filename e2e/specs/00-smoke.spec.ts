import { test, expect } from '@playwright/test';
import { STORAGE, newContextAs } from '../fixtures/roles';
import { TESTDATA } from '../fixtures/testdata';

/**
 * Smoke del harness: valida que la configuración (auth por storageState, baseURL,
 * datos sembrados) funciona de punta a punta ANTES de escribir los 12 flujos.
 * No cubre scope de negocio — es el canario de la suite.
 */

test.describe('smoke: sesión de estudiante', () => {
  test.use({ storageState: STORAGE.student1 });

  test('student1 entra ya autenticado y ve el curso sembrado', async ({ page }) => {
    await page.goto('/my/courses.php');
    // .first(): la tarjeta del curso repite el link (nombre + overlay) — strict mode los ve como 2.
    await expect(
      page.getByRole('link', { name: new RegExp(TESTDATA.course.fullname) }).first(),
    ).toBeVisible();
  });
});

test.describe('smoke: sesión de profesor', () => {
  test.use({ storageState: STORAGE.teacher });

  test('teacher1 abre el curso y ve ambos quizzes sembrados', async ({ page }) => {
    await page.goto('/my/courses.php');
    await page.getByRole('link', { name: new RegExp(TESTDATA.course.fullname) }).first().click();
    // .first(): cada actividad aparece 2 veces (course index drawer + contenido del curso).
    await expect(page.getByRole('link', { name: TESTDATA.quizzes.general.name }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: TESTDATA.quizzes.timed.name }).first()).toBeVisible();
  });
});

test.describe('smoke: multi-rol en un mismo test', () => {
  test.use({ storageState: STORAGE.student1 });

  test('estudiante y profesor conviven en contexts aislados (patrón de SPECS §4.2)', async ({
    page,
    browser,
  }) => {
    // Contexto principal: estudiante.
    await page.goto('/my/courses.php');
    await expect(
      page.getByRole('link', { name: new RegExp(TESTDATA.course.fullname) }).first(),
    ).toBeVisible();

    // Segundo contexto: profesor, sin logout/login por UI.
    const teacherCtx = await newContextAs(browser, 'teacher');
    try {
      const teacherPage = await teacherCtx.newPage();
      await teacherPage.goto('/my/courses.php');
      await expect(
        teacherPage.getByRole('link', { name: new RegExp(TESTDATA.course.fullname) }).first(),
      ).toBeVisible();
    } finally {
      await teacherCtx.close();
    }
  });
});
