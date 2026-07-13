import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Ciclo del estudiante: iniciar intento, responder por tipo, navegar, marcar,
 * enviar y leer la revisión (flujos 6, 7, 8, 9 y specs de los Cambios).
 *
 * Convención: los métodos answer* operan sobre la pregunta visible n-ésima de la
 * página actual (default 0) — con questionsperpage=1 casi siempre hay una sola.
 */
export class QuizAttemptPage extends BasePage {
  /** Botón de inicio: "Attempt quiz" o "Re-attempt quiz" según historial. */
  readonly attemptButton: Locator;
  readonly timer: Locator;
  readonly submitAllButton: Locator;

  constructor(page: Page) {
    super(page);
    this.attemptButton = page.getByRole('button', {
      name: /Attempt quiz|Re-attempt quiz|Continue your attempt|Preview quiz/,
    });
    this.timer = page.locator('#quiz-time-left');
    this.submitAllButton = page.getByRole('button', { name: 'Submit all and finish' });
  }

  /** Contenedor de la pregunta n-ésima de la página actual. */
  question(index = 0): Locator {
    return this.page.locator('.que').nth(index);
  }

  /**
   * Inicia (o reinicia) un intento desde la vista del quiz.
   * Maneja el pre-flight: password (flujo 12) y/o confirmación de límite de tiempo (flujo 7).
   */
  async startAttempt(options: { password?: string } = {}): Promise<void> {
    await this.attemptButton.click();

    // Pre-flight modal/página: aparece con password o timelimit; si no, entra directo.
    const start = this.page.getByRole('button', { name: 'Start attempt' });
    const appeared = await start.waitFor({ state: 'visible', timeout: 5_000 }).then(
      () => true,
      () => false,
    );
    if (appeared) {
      if (options.password !== undefined) {
        await this.fillPreflightPassword(options.password);
      }
      await start.click();
    }
    await this.waitForMoodleReady();
  }

  /**
   * Llena el password del pre-flight. Es un widget passwordunmask (DOM verificado:
   * input d-none hasta clickear el pencil "Edit password") DENTRO de un modal —
   * y la página puede tener varios dialogs visibles, así que se scopea por el
   * wrapper del widget. Sin Enter: el submit lo hace el botón "Start attempt".
   */
  async fillPreflightPassword(password: string): Promise<void> {
    const wrapper = this.page.locator(
      'div[data-passwordunmask="wrapper"][data-passwordunmaskid="id_quizpassword"]:visible',
    );
    const editBtn = wrapper.locator('a[data-passwordunmask="edit"]');
    const input = wrapper.locator('#id_quizpassword');
    
    await expect(async () => {
      // Si el input está oculto, intentar revelarlo. 
      // Al estar dentro de toPass, maneja el caso de que el JS de Moodle aún no estuviera listo en el primer click.
      if (!(await input.isVisible())) {
        await editBtn.click();
      }
      await input.fill(password);
      await expect(input).toHaveValue(password);
    }).toPass({ timeout: 15_000 });
  }

  // ── Respuestas por tipo de pregunta ────────────────────────────────────────

  /** Escapa texto para usarlo como regex de accessible name (match por substring). */
  private static rx(text: string): RegExp {
    return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }

  async answerMultichoice(optionText: string, index = 0): Promise<void> {
    // Boost 4.5 NO usa <label> en las opciones: el radio lleva el accessible name
    // ("a. París") y el texto visible es un div (verificado en el aria snapshot).
    await this.question(index).getByRole('radio', { name: QuizAttemptPage.rx(optionText) }).check();
  }

  async answerTrueFalse(value: boolean, index = 0): Promise<void> {
    await this.question(index)
      .getByRole('radio', { name: value ? 'True' : 'False' })
      .check();
  }

  async answerText(text: string, index = 0): Promise<void> {
    // shortanswer y numerical usan el mismo input de texto (name termina en :answer).
    await this.question(index).locator('input[type="text"][name$="answer"]').fill(text);
  }

  async answerEssay(text: string, index = 0): Promise<void> {
    // Editor plano (preferencia htmleditor=textarea sembrada): textarea directo, sin iframes.
    await this.question(index).locator('textarea[name$="answer"]').fill(text);
  }

  async answerMatching(pairs: ReadonlyArray<{ item: string; match: string }>, index = 0): Promise<void> {
    const rows = this.question(index).locator('table.answer tr');
    for (const pair of pairs) {
      await rows
        .filter({ hasText: pair.item })
        .locator('select')
        .selectOption({ label: pair.match });
    }
  }

  // ── Navegación y marcado (flujo 6) ─────────────────────────────────────────

  async nextPage(): Promise<void> {
    await this.page.locator('.mod_quiz-next-nav').click();
    await this.waitForMoodleReady();
  }

  async previousPage(): Promise<void> {
    await this.page.locator('.mod_quiz-prev-nav').click();
    await this.waitForMoodleReady();
  }

  /** El panel de navegación vive en el block drawer, colapsado por defecto. */
  private async ensureNavPanelVisible(): Promise<void> {
    if (await this.page.locator('#quiznavbutton1').isVisible()) {
      return;
    }
    await this.page.getByRole('button', { name: /Open block drawer/ }).click();
    await this.page.locator('#quiznavbutton1').waitFor({ state: 'visible' });
  }

  /** Salta a una pregunta desde el panel de navegación lateral (1-based). */
  async jumpToQuestion(n: number): Promise<void> {
    await this.ensureNavPanelVisible();
    await this.page.locator(`#quiznavbutton${n}`).click();
    await this.waitForMoodleReady();
  }

  /** Botón del panel de navegación (para asserts de estado: flagged, answered). */
  navButton(n: number): Locator {
    return this.page.locator(`#quiznavbutton${n}`);
  }

  /** Marca/desmarca la pregunta actual "para revisar" (flag). */
  async toggleFlag(index = 0): Promise<void> {
    // El accessible name del botón es el ESTADO ("Flagged"/"Not flagged"), no el
    // texto visible "Flag question" (verificado en aria snapshot): /Flag/ cubre ambos.
    await this.question(index).getByRole('button', { name: /Flag/ }).click();
  }

  // ── Envío (flujo 8) ────────────────────────────────────────────────────────

  /** Va a la página de resumen del intento. */
  async finishAttempt(): Promise<void> {
    // El link "Finish attempt..." vive en el block drawer (colapsado por defecto,
    // F18); abrirlo lo hace clickeable desde cualquier página del intento.
    await this.ensureNavPanelVisible();
    await this.page.getByRole('link', { name: /Finish attempt/ }).click();
    await this.waitForMoodleReady();
  }

  /** En el resumen: envía todo, confirmando el modal si aparece. */
  async submitAll(): Promise<void> {
    await this.submitAllButton.click();
    // En estado overdue (gracia) Moodle envía DIRECTO, sin modal de confirmación
    // (verificado en spec 10); en el envío normal el modal sí aparece.
    const confirm = this.modal.getByRole('button', { name: 'Submit all and finish' });
    if (await confirm.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false)) {
      await confirm.click();
    }
    await this.waitForMoodleReady();
  }

  /** Atajo del flujo completo: resumen + envío confirmado. */
  async finishAndSubmit(): Promise<void> {
    await this.finishAttempt();
    await this.submitAll();
  }

  // ── Revisión y estado (flujos 8, 9, Cambio 4) ─────────────────────────────

  /** Tabla-resumen de la revisión del intento (Started on / State / Grade...). */
  get reviewSummary(): Locator {
    return this.page.locator('table.quizreviewsummary');
  }

  /**
   * Tabla-resumen de un intento en la vista del quiz ("Your attempts").
   * En 4.5 cada intento es una tabla con caption "Attempt N summary" (= accessible name).
   */
  attemptSummaryTable(attempt = 1): Locator {
    return this.page.getByRole('table', { name: `Attempt ${attempt} summary` });
  }

  /** Heading "Highest grade: X / Y." de la vista del quiz (nota según grademethod). */
  get finalGradeHeading(): Locator {
    return this.page.getByRole('heading', { name: /Highest grade|Final grade|Grade:/ });
  }

  /** Aviso de penalización del Cambio 4 en la página de revisión. */
  get gracePenaltyNotice(): Locator {
    return this.page.locator('#local-graceguard-notice');
  }
}
