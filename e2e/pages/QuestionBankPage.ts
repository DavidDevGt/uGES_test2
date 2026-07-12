import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Banco de preguntas del curso (flujos 2 y 3).
 * Con la preferencia htmleditor=textarea sembrada, todos los campos ricos son
 * <textarea> planos — sin iframes de TinyMCE.
 */
export class QuestionBankPage extends BasePage {
  /** Abre el banco a nivel curso (More → Question bank). */
  async openFromCourse(courseFullname: string): Promise<void> {
    await this.openCourse(courseFullname);
    await this.page.getByRole('link', { name: 'More', exact: true }).click();
    await this.page.getByRole('link', { name: 'Question bank' }).click();
    await this.waitForMoodleReady();
  }

  /** Fila de una pregunta en el listado (para asserts de existencia/tipo). */
  questionRow(name: string): Locator {
    return this.page.locator('table#categoryquestions tr', { hasText: name });
  }

  /** Abre el chooser y selecciona el tipo. Deja abierto el form de la pregunta. */
  private async startCreation(qtypeLabel: string): Promise<void> {
    await this.page.getByRole('button', { name: /Create a new question/ }).click();
    await this.modal.getByRole('radio', { name: qtypeLabel, exact: true }).check();
    await this.modal.getByRole('button', { name: 'Add' }).click();
    await this.waitForMoodleReady();
  }

  private async fillCommon(name: string, questionText: string): Promise<void> {
    await this.page.locator('#id_name').fill(name);
    await this.page.locator('#id_questiontext').fill(questionText);
  }

  private async save(): Promise<void> {
    await this.page.locator('#id_submitbutton').click();
    await this.waitForMoodleReady();
  }

  async createMultichoice(
    name: string,
    text: string,
    correctChoice: string,
    wrongChoices: readonly string[],
  ): Promise<void> {
    await this.startCreation('Multiple choice');
    await this.fillCommon(name, text);
    await this.page.locator('#id_answer_0').fill(correctChoice);
    await this.page.locator('#id_fraction_0').selectOption({ label: '100%' });
    for (const [i, choice] of wrongChoices.entries()) {
      await this.page.locator(`#id_answer_${i + 1}`).fill(choice);
    }
    await this.save();
  }

  async createTrueFalse(name: string, text: string, correct: boolean): Promise<void> {
    await this.startCreation('True/False');
    await this.fillCommon(name, text);
    await this.page.locator('#id_correctanswer').selectOption({ label: correct ? 'True' : 'False' });
    await this.save();
  }

  async createShortAnswer(name: string, text: string, answer: string): Promise<void> {
    await this.startCreation('Short answer');
    await this.fillCommon(name, text);
    await this.page.locator('#id_answer_0').fill(answer);
    await this.page.locator('#id_fraction_0').selectOption({ label: '100%' });
    await this.save();
  }

  async createNumerical(name: string, text: string, answer: string): Promise<void> {
    await this.startCreation('Numerical');
    await this.fillCommon(name, text);
    await this.page.locator('#id_answer_0').fill(answer);
    await this.page.locator('#id_fraction_0').selectOption({ label: '100%' });
    await this.save();
  }

  async createMatching(
    name: string,
    text: string,
    pairs: ReadonlyArray<{ item: string; match: string }>,
  ): Promise<void> {
    await this.startCreation('Matching');
    await this.fillCommon(name, text);
    for (const [i, pair] of pairs.entries()) {
      await this.page.locator(`#id_subquestions_${i}`).fill(pair.item);
      await this.page.locator(`#id_subanswers_${i}`).fill(pair.match);
    }
    await this.save();
  }

  async createEssay(name: string, text: string): Promise<void> {
    await this.startCreation('Essay');
    await this.fillCommon(name, text);
    await this.save();
  }
}
