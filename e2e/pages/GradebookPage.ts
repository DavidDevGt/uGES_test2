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

  async open(courseFullname: string): Promise<void> {
    await this.openCourse(courseFullname);
    // Lectura SIEMPRE sin edición: los asserts leen texto, no inputs.
    await this.setEditMode(false);
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

  /**
   * Single view de un usuario por URL directa (flujo 11: override de notas).
   * itemid = userid en modo "user" del reporte singleview.
   */
  async openSingleViewForUser(courseFullname: string, userId: number): Promise<void> {
    await this.openCourse(courseFullname);
    const courseId = this.cmidFromUrl();
    const url = `/grade/report/singleview/index.php?id=${courseId}&item=user&itemid=${userId}`;

    // El single view requiere Edit mode para los inputs override_*/finalgrade_*.
    // Auto-reparación: si tras navegar los inputs no están (el AJAX de edit mode se
    // perdió bajo contención), se reintenta una vez. Elimina la carrera del toggle
    // que hacía flaky al override en la suite completa (F24).
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.setEditMode(true);
      await this.page.goto(url);
      await this.waitForMoodleReady();
      if ((await this.page.locator('input[name^="override_"]').count()) > 0) {
        return;
      }
    }
    // Última verificación explícita: si sigue sin inputs, es un fallo real, no flaky.
    await expect(this.page.locator('input[name^="override_"]').first()).toBeVisible();
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

  /** Guarda los cambios en Single View y maneja la redirección/confirmación. */
  async saveSingleView(): Promise<void> {
    const saveBtn = this.page.getByRole('button', { name: 'Save' });
    // Single View hace un POST tradicional. Hay que esperar la recarga de página.
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'load' }),
      saveBtn.click()
    ]);

    const cont = this.page.getByRole('button', { name: 'Continue' });
    if (await cont.isVisible()) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'load' }),
        cont.click()
      ]);
    }
    await this.waitForMoodleReady();
  }
}
