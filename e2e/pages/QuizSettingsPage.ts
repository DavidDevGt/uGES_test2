import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Momentos de las opciones de revisión (columnas del fieldset "Review options"). */
export type ReviewMoment = 'during' | 'immediately' | 'open' | 'closed';
/** Opciones de revisión relevantes al scope (flujo 4). */
export type ReviewOption = 'attempt' | 'correctness' | 'marks' | 'rightanswer' | 'generalfeedback';

/**
 * Formulario de settings del quiz (modedit) + creación del quiz por UI.
 * Cubre flujos 1 (crear/configurar), 4 (opciones de revisión) y 12 (restricciones).
 * Ids id_* del mform de Moodle: estables en core, encapsulados aquí (SPECS §4.2).
 */
export class QuizSettingsPage extends BasePage {
  readonly name: Locator;
  readonly saveAndDisplay: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.locator('#id_name');
    this.saveAndDisplay = page.locator('#id_submitbutton');
  }

  /** Crea un quiz nuevo en el curso vía UI (flujo 1). Deja abierto el form de settings. */
  async startQuizCreation(courseFullname: string): Promise<void> {
    await this.openCourse(courseFullname);
    await this.setEditMode(true);
    await this.page.getByRole('button', { name: 'Add an activity or resource' }).last().click();
    // Chooser modal: el item de cada módulo es un link con el nombre del módulo.
    await this.modal.getByRole('link', { name: 'Quiz', exact: true }).click();
    await this.waitForMoodleReady();
  }

  /** Abre el form de settings de un quiz existente (URL directa: el nav lo expone como menuitem, no link). */
  async openSettings(courseFullname: string, quizName: string): Promise<void> {
    await this.openQuiz(courseFullname, quizName);
    const cmid = this.cmidFromUrl();
    await this.page.goto(`/course/modedit.php?update=${cmid}&return=1`);
    await this.waitForMoodleReady();
  }

  /** Expande todas las secciones del mform (los campos colapsados no son interactuables). */
  async expandAll(): Promise<void> {
    // El control real es a.collapseexpand cuyo estado vive en su clase 'collapsed'
    // (el getByRole('Expand all') matchea items de dropdown ocultos — DOM verificado).
    const toggle = this.page.locator('a.collapseexpand');
    if ((await toggle.count()) > 0 && (((await toggle.getAttribute('class')) ?? '').includes('collapsed'))) {
      await toggle.click();
    }
  }

  async setName(value: string): Promise<void> {
    await this.name.fill(value);
  }

  /** Límite de tiempo en minutos (flujo 1 / timing). */
  async setTimeLimit(minutes: number): Promise<void> {
    await this.page.locator('#id_timelimit_enabled').check();
    await this.page.locator('#id_timelimit_number').fill(String(minutes));
    await this.page.locator('#id_timelimit_timeunit').selectOption({ label: 'minutes' });
  }

  /** Intentos permitidos: número o 'Unlimited'. */
  async setAttemptsAllowed(value: number | 'Unlimited'): Promise<void> {
    await this.page.locator('#id_attempts').selectOption({ label: String(value) });
  }

  /** Método de calificación por label nativo: 'Highest grade', 'Average grade', etc. */
  async setGradeMethod(label: string): Promise<void> {
    await this.page.locator('#id_grademethod').selectOption({ label });
  }

  /** Manejo de tiempo excedido (flujo 7 / Cambio 4): label nativo del select. */
  async setOverdueHandling(label: string): Promise<void> {
    await this.page.locator('#id_overduehandling').selectOption({ label });
  }

  /**
   * Opción de revisión (flujo 4): checkbox id_{option}{moment} del fieldset nativo.
   * Nota: la columna 'during' solo aplica a comportamientos interactivos.
   */
  async setReviewOption(option: ReviewOption, moment: ReviewMoment, enabled: boolean): Promise<void> {
    await this.page.locator(`#id_${option}${moment}`).setChecked(enabled);
  }

  /** Contraseña de acceso (flujo 12, "Extra restrictions on attempts"). */
  async setPassword(password: string): Promise<void> {
    // Widget passwordunmask (DOM verificado): el input vive d-none hasta clickear
    // el pencil "Edit password"; Enter persiste el valor en el widget.
    const wrapper = this.page.locator(
      'div[data-passwordunmask="wrapper"][data-passwordunmaskid="id_quizpassword"]',
    );
    await wrapper.locator('a[data-passwordunmask="edit"]').click();
    const input = this.page.locator('#id_quizpassword');
    await input.fill(password);
    await input.press('Enter');
  }

  /**
   * Ventana de fechas (flujo 12). Los date selectors de Moodle son selects separados.
   * Pasar null deshabilita el campo.
   */
  async setDateField(field: 'timeopen' | 'timeclose', date: Date | null): Promise<void> {
    const enabled = this.page.locator(`#id_${field}_enabled`);
    if (date === null) {
      await enabled.uncheck();
      return;
    }
    await enabled.check();
    await this.page.locator(`#id_${field}_day`).selectOption(String(date.getDate()));
    await this.page.locator(`#id_${field}_month`).selectOption(String(date.getMonth() + 1));
    await this.page.locator(`#id_${field}_year`).selectOption(String(date.getFullYear()));
    await this.page.locator(`#id_${field}_hour`).selectOption(String(date.getHours()));
    await this.page.locator(`#id_${field}_minute`).selectOption(String(date.getMinutes()));
  }

  /** Guarda con "Save and display" (queda en la vista del quiz). */
  async save(): Promise<void> {
    await this.saveAndDisplay.click();
    await this.waitForMoodleReady();
  }
}
