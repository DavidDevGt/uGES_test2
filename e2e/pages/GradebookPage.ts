import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Gradebook del curso (flujos 9 y 11, y assert de gradebook del Cambio 4).
 * Los asserts "de verdad" contra la nota final viven aquí, no en la UI del quiz.
 */
export class GradebookPage extends BasePage {
  /**
   * Abre el Grader report del curso por URL directa (grade/report/grader/index.php?id=N).
   * No se clickea "Grades": la página del curso del profesor tiene DOS links con ese
   * nombre (navegación del curso y user menu) — strict mode los rechaza (verificado).
   */
  async open(courseFullname: string): Promise<void> {
    await this.openCourse(courseFullname);
    const courseId = this.cmidFromUrl(); // en course/view.php?id=N, id ES el courseid
    await this.page.goto(`/grade/report/grader/index.php?id=${courseId}`);
    await this.waitForMoodleReady();
  }

  /** Fila del grader report para un estudiante (tabla #user-grades, verificada en 4.5). */
  studentRow(studentName: string): Locator {
    return this.page.locator('#user-grades tr', { hasText: studentName });
  }

  /**
   * Celda de nota de un estudiante para un ítem (quiz) por su posición de columna.
   * El grader report marca cada celda con data-itemid, pero el itemid es dinámico:
   * los specs asserts usan la fila completa + texto esperado, que es estable.
   */
  gradeCellsFor(studentName: string): Locator {
    return this.studentRow(studentName).locator('td.grade');
  }

  /** Override de nota vía Single view del ítem (flujo 11). */
  async openSingleViewForStudent(courseFullname: string, studentName: string): Promise<void> {
    await this.open(courseFullname);
    // El menú contextual de la fila del estudiante ofrece "Single view for this user".
    await this.studentRow(studentName).getByRole('button', { name: /actions/i }).first().click();
    await this.page.getByRole('link', { name: /Single view/ }).click();
    await this.waitForMoodleReady();
  }
}
