import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Página de edición de preguntas del quiz (mod/quiz/edit.php) — flujo 3:
 * agregar preguntas del banco y aleatorias. Se navega por URL con el cmid
 * extraído de la vista (los menús cambian entre versiones; la URL no).
 */
export class QuizEditPage extends BasePage {
  /** Abre edit.php del quiz. */
  async open(courseFullname: string, quizName: string): Promise<void> {
    await this.openQuiz(courseFullname, quizName);
    const cmid = this.cmidFromUrl();
    await this.page.goto(`/mod/quiz/edit.php?cmid=${cmid}`);
    await this.waitForMoodleReady();
  }

  /** Lista de slots del quiz en el editor. */
  get slots(): Locator {
    return this.page.locator('ul.slots li.activity');
  }

  slotByText(text: string | RegExp): Locator {
    return this.slots.filter({ hasText: text });
  }

  /**
   * Abre el menú "Add" y clickea un item. El trigger es a.dropdown-toggle (hay
   * "Add" ocultos de otros modales: filtrar por visible) y los items son
   * role=menuitem, no links (DOM verificado).
   */
  private async clickAddMenuItem(itemPattern: RegExp): Promise<void> {
    // hasText por substring: el innerText del toggle trae whitespace que rompe /^Add$/.
    await this.page.locator('a.dropdown-toggle:visible', { hasText: 'Add' }).last().click();
    await this.page.getByRole('menuitem', { name: itemPattern }).click();
    await this.waitForMoodleReady();
  }

  /**
   * Agrega una pregunta existente del banco (flujo 3). El modal lista por defecto
   * la categoría "Default" del curso — el caller debe usar preguntas que vivan ahí
   * (las E2E-* creadas por UI; las SEED-* del seeding viven en otra categoría).
   */
  async addFromBank(questionName: string): Promise<void> {
    await this.clickAddMenuItem(/from question bank/);
    const modal = this.page.locator('.modal.show');
    await modal.locator('tr', { hasText: questionName }).getByRole('checkbox').check();
    await modal.getByRole('button', { name: /Add selected questions/ }).click();
    await this.waitForMoodleReady();
  }

  /** Agrega una pregunta aleatoria de la categoría por defecto del modal (flujo 3). */
  async addRandom(): Promise<void> {
    await this.clickAddMenuItem(/a random question/);
    const modal = this.page.locator('.modal.show');
    await modal.getByRole('button', { name: /Add random question/ }).click();
    await this.waitForMoodleReady();
  }

  /**
   * Crea una pregunta True/False nueva DENTRO del quiz (menú "a new question" →
   * chooser YUI). Evita depender del filtro de categorías del modal del banco —
   * los specs de quizzes propios (01, 08) la usan para autoproveerse.
   */
  async addNewTrueFalse(name: string, text: string, correct: boolean): Promise<void> {
    await this.clickAddMenuItem(/a new question/);
    const chooser = this.page
      .locator('.moodle-dialogue-wrap', { hasText: 'Choose a question type' })
      .last();
    await chooser.locator('#item_qtype_truefalse').check();
    await chooser.getByRole('button', { name: 'Add', exact: true }).click();
    await this.waitForMoodleReady();

    await this.page.locator('#id_name').fill(name);
    await this.page.locator('#id_questiontext').fill(text);
    await this.page.locator('#id_correctanswer').selectOption({ label: correct ? 'True' : 'False' });
    await this.page.locator('#id_submitbutton').click();
    await this.waitForMoodleReady();
  }
}
