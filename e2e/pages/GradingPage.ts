import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Calificación manual (flujo 10): reporte "Manual grading" del quiz.
 * Se navega por URL estable report.php?id=cmid&mode=grading (el cmid se extrae
 * de la vista del quiz) — los menús terciarios cambian entre versiones.
 */
export class GradingPage extends BasePage {
  /** Abre el reporte de calificación manual del quiz. */
  async open(courseFullname: string, quizName: string): Promise<void> {
    await this.openQuiz(courseFullname, quizName);
    const cmid = this.cmidFromUrl();
    await this.page.goto(`/mod/quiz/report.php?id=${cmid}&mode=grading`);
    await this.waitForMoodleReady();
  }

  /** Fila del listado de preguntas pendientes de calificar. */
  questionRow(questionName: string): Locator {
    return this.page.locator('table#questionstograde tr', { hasText: questionName });
  }

  /** Entra a calificar todos los intentos de una pregunta ("grade all" / "grade"). */
  async openGradingFor(questionName: string): Promise<void> {
    await this.questionRow(questionName).getByRole('link', { name: /grade/i }).first().click();
    await this.waitForMoodleReady();
  }

  /**
   * Asigna nota (y comentario opcional) a la respuesta n-ésima visible y guarda.
   * El comentario es un textarea plano (preferencia htmleditor=textarea del seed).
   */
  async gradeVisibleAnswer(mark: string, comment?: string, index = 0): Promise<void> {
    if (comment !== undefined) {
      await this.page.locator('textarea[name$="-comment"]').nth(index).fill(comment);
    }
    await this.page.locator('input[name$="-mark"]').nth(index).fill(mark);
    await this.page.getByRole('button', { name: /Save and go to the next page|Save and show next/ }).click();
    await this.waitForMoodleReady();
  }
}
