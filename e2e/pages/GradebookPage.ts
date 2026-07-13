import { expect, type Locator, type Page } from '@playwright/test';
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
  /**
   * Cambia el Edit mode del usuario actual. OJO: es una PREFERENCIA DE USUARIO
   * en el servidor — activarla en un contexto contamina a todos los demás del
   * mismo rol (causó 3 fallos fantasma: el grader en edición renderiza inputs
   * sin texto y los toContainText no ven las notas).
   */
  private async setEditMode(on: boolean): Promise<void> {
    const toggle = this.page.locator('.editmode-switch-form input[type="checkbox"]');
    if ((await toggle.count()) === 0) {
      return;
    }
    if ((await toggle.isChecked()) === on) {
      return;
    }
    // El toggle es un form auto-submit → round-trip al servidor. waitForLoadState
    // corría una carrera (podía ver el 'load' viejo antes de que la navegación
    // empezara). La aserción auto-reintentante sobre el estado resultante espera
    // de forma fiable a que la preferencia se persista y la página recargue.
    await toggle.click();
    await expect(this.page.locator('.editmode-switch-form input[type="checkbox"]')).toBeChecked({
      checked: on,
    });
    await this.waitForMoodleReady();
  }

  async open(courseFullname: string): Promise<void> {
    await this.openCourse(courseFullname);
    const courseId = this.cmidFromUrl(); // en course/view.php?id=N, id ES el courseid
    await this.page.goto(`/grade/report/grader/index.php?id=${courseId}`);
    await this.waitForMoodleReady();
    // Lectura SIEMPRE sin edición: los asserts leen texto, no inputs.
    await this.setEditMode(false);
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

  /**
   * Single view de un usuario por URL directa (flujo 11: override de notas).
   * itemid = userid en modo "user" del reporte singleview.
   */
  async openSingleViewForUser(courseFullname: string, userId: number): Promise<void> {
    await this.openCourse(courseFullname);
    const courseId = this.cmidFromUrl();
    await this.page.goto(`/grade/report/singleview/index.php?id=${courseId}&item=user&itemid=${userId}`);
    await this.waitForMoodleReady();

    // El single view es de SOLO LECTURA sin Edit mode (verificado en DOM vivo):
    // los inputs override_*/finalgrade_* solo existen en modo edición.
    await this.setEditMode(true);
  }

  /** Fila de un grade item dentro del single view. */
  singleViewRow(itemName: string): Locator {
    return this.page.locator('table tr', { hasText: itemName });
  }

  /** Checkbox de override de la fila (name=override_<itemid>_<userid>, sin aria). */
  overrideCheckbox(itemName: string): Locator {
    return this.singleViewRow(itemName).locator('input[name^="override_"]');
  }

  /** Input numérico de la nota final de la fila. */
  gradeInput(itemName: string): Locator {
    return this.singleViewRow(itemName).locator('input[name^="finalgrade_"]');
  }

  /** Guarda el single view (maneja la pantalla intermedia de confirmación si aparece). */
  async saveSingleView(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save' }).click();
    const cont = this.page.getByRole('button', { name: 'Continue' });
    if (await cont.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false)) {
      await cont.click();
    }
    await this.waitForMoodleReady();
  }
}
