import { type Locator, type Page } from '@playwright/test';

/**
 * Base de todos los Page Objects de Moodle.
 *
 * Aporta las dos piezas transversales:
 * - waitForMoodleReady(): espera estilo Behat sobre M.util.pending_js — la señal
 *   oficial de "Moodle terminó su JS async" (F13: módulos como togglesensitive
 *   re-crean inputs al inicializarse).
 * - Navegación por NOMBRE (curso → actividad): los ids de curso/cmid son dinámicos
 *   por seed, así que nunca se hardcodean URLs con ids.
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForMoodleReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      type MoodleWindow = Window & { M?: { util?: { pending_js?: unknown[] } } };
      const util = (window as MoodleWindow).M?.util;
      return util?.pending_js !== undefined && util.pending_js.length === 0;
    });
  }

  /** Abre la página principal del curso desde "My courses". */
  async openCourse(courseFullname: string): Promise<void> {
    await this.page.goto('/my/courses.php');
    // .first(): la tarjeta del curso duplica el link (nombre + overlay).
    await this.page.getByRole('link', { name: new RegExp(courseFullname) }).first().click();
    await this.waitForMoodleReady();
  }

  /** Abre la página de vista de un quiz (mod/quiz/view.php) navegando por nombre. */
  async openQuiz(courseFullname: string, quizName: string): Promise<void> {
    await this.openCourse(courseFullname);
    // .first(): cada actividad aparece en el course index drawer Y en el contenido.
    await this.page.getByRole('link', { name: quizName }).first().click();
    await this.waitForMoodleReady();
  }

  /**
   * cmid del módulo actual, extraído de la URL (view.php?id=N).
   * Permite saltar a sub-páginas estables (report.php?id=cmid&mode=...) sin
   * depender de menús terciarios que cambian entre versiones.
   */
  cmidFromUrl(): number {
    const match = this.page.url().match(/[?&]id=(\d+)/);
    if (!match) {
      throw new Error(`No se pudo extraer cmid de la URL: ${this.page.url()}`);
    }
    return Number(match[1]);
  }

  /** Diálogo modal activo (confirmaciones de Moodle). */
  get modal(): Locator {
    return this.page.getByRole('dialog');
  }

  /**
   * Cambia el Edit mode del usuario actual vía el endpoint interno de Moodle.
   * Evita la contención del auto-submit del toggle en UI durante la ejecución
   * paralela de tests.
   */
  async setEditMode(on: boolean): Promise<void> {
    const toggleLocator = this.page.locator('.editmode-switch-form input[type="checkbox"]');
    
    try {
      // Esperar a que el toggle de edición exista en el DOM.
      // En modo headed o bajo carga, Moodle puede demorar en inyectarlo.
      await toggleLocator.waitFor({ state: 'attached', timeout: 5000 });
    } catch (e) {
      return; // Si no existe el toggle, retornamos silenciosamente (ej. sin permisos)
    }

    const isChecked = await toggleLocator.isChecked();
    if (isChecked === on) {
      return;
    }

    const contextId = await toggleLocator.evaluate((el: HTMLInputElement) => el.dataset.context);

    await this.page.evaluate(async ({ context, setmode }) => {
      return new Promise<void>((resolve, reject) => {
        // @ts-ignore
        require(['core/ajax'], function (ajax) {
          if (!context) {
            reject(new Error('No context found for edit mode toggle'));
            return;
          }
          ajax.call([{
            methodname: 'core_change_editmode',
            args: { context, setmode }
          }])[0].then(() => resolve()).catch(reject);
        });
      });
    }, { context: contextId, setmode: on });

    await this.page.reload();
    await this.waitForMoodleReady();
  }
}
