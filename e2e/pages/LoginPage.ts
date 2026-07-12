import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Página de login de Moodle (theme Boost).
 * Los ids #username/#password son estables en Moodle core; quedan encapsulados
 * aquí según la regla de selectores de SPECS §4.2 (CSS solo como último recurso, en el PO).
 */
export class LoginPage {
  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  /** Menú de usuario del navbar: visible solo con sesión iniciada (Boost 4.5: #user-menu-toggle, F11). */
  readonly userMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    this.submit = page.getByRole('button', { name: 'Log in' });
    this.userMenu = page.locator('#user-menu-toggle');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login/index.php');
  }

  /**
   * Espera estilo Behat: Moodle registra su trabajo JS asíncrono en M.util.pending_js.
   * Necesaria porque core/togglesensitive REEMPLAZA el input de password al terminar
   * de renderizar su template (sensitiveInput.outerHTML = html), borrando lo ya
   * tecleado — en CI el template tarda (caches fríos) y el fill caía en esa ventana,
   * enviando el POST con password vacío (hallazgo F13).
   */
  private async waitForMoodleReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      type MoodleWindow = Window & { M?: { util?: { pending_js?: unknown[] } } };
      const util = (window as MoodleWindow).M?.util;
      return util?.pending_js !== undefined && util.pending_js.length === 0;
    });
  }

  /** Login por el form real: Moodle exige el logintoken oculto — el form lo aporta solo. */
  async login(username: string, password: string): Promise<void> {
    await this.waitForMoodleReady();
    await this.username.fill(username);
    // Cinturón y tirantes sobre la espera: reintenta hasta que el valor persista
    // (si algún módulo re-creara el input, el fill se repite post-reemplazo).
    await expect(async () => {
      await this.password.fill(password);
      await expect(this.password).toHaveValue(password);
    }).toPass({ timeout: 15_000 });
    await this.submit.click();
  }
}
