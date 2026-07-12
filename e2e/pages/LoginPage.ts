import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Página de login de Moodle (theme Boost).
 * Los ids #username/#password son estables en Moodle core; quedan encapsulados
 * aquí según la regla de selectores de SPECS §4.2 (CSS solo como último recurso, en el PO).
 */
export class LoginPage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  /** Menú de usuario del navbar: visible solo con sesión iniciada (Boost 4.5: #user-menu-toggle, F11). */
  readonly userMenu: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    this.submit = page.getByRole('button', { name: 'Log in' });
    this.userMenu = page.locator('#user-menu-toggle');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login/index.php');
  }

  /** Login por el form real: Moodle exige el logintoken oculto — el form lo aporta solo. */
  async login(username: string, password: string): Promise<void> {
    // F13: core/togglesensitive REEMPLAZA el input de password al resolver su template
    // (outerHTML), borrando lo tecleado. pending_js cubre ese trabajo async.
    await this.waitForMoodleReady();
    await this.username.fill(username);
    // Cinturón y tirantes sobre la espera: reintenta hasta que el valor persista.
    await expect(async () => {
      await this.password.fill(password);
      await expect(this.password).toHaveValue(password);
    }).toPass({ timeout: 15_000 });
    await this.submit.click();
  }
}
