import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Reporte de intentos del profesor — "Grades" overview (flujos 10, 11 y Cambio 2).
 * Aquí viven los badges de local_focusguard ("Focus: N").
 */
export class AttemptsReportPage extends BasePage {
  /** Abre el reporte overview del quiz (URL estable por cmid). */
  async open(courseFullname: string, quizName: string): Promise<void> {
    await this.openQuiz(courseFullname, quizName);
    const cmid = this.cmidFromUrl();
    await this.page.goto(`/mod/quiz/report.php?id=${cmid}&mode=overview`);
    await this.waitForMoodleReady();
  }

  /** Fila de intento por nombre del estudiante (tabla #attempts del overview). */
  attemptRow(studentName: string): Locator {
    return this.page.locator('table#attempts tbody tr', { hasText: studentName });
  }

  /** Badge de pérdidas de foco del Cambio 2 en la fila del estudiante. */
  focusBadge(studentName: string): Locator {
    return this.attemptRow(studentName).locator('.focusguard-badge');
  }

  /** Link a la revisión del intento del estudiante (para saltar al detalle). */
  reviewLink(studentName: string): Locator {
    return this.attemptRow(studentName).getByRole('link', { name: /Review attempt/ });
  }

  /** Selecciona todos los intentos y dispara el regrade (flujo 10). */
  async regradeAllAttempts(): Promise<void> {
    await this.page.getByRole('checkbox', { name: /Select all/ }).first().check();
    await this.page.getByRole('button', { name: /Regrade selected attempts/ }).click();
    // Moodle muestra una página de progreso y un botón Continue al terminar.
    const cont = this.page.getByRole('button', { name: 'Continue' });
    if (await cont.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false)) {
      await cont.click();
    }
    await this.waitForMoodleReady();
  }
}
