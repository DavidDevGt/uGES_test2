import type { Locator, Page } from '@playwright/test';

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
  /** Menú de usuario del navbar: visible solo con sesión iniciada. */
  readonly userMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    this.submit = page.getByRole('button', { name: 'Log in' });
    // Verificado contra el DOM real de Boost 4.5 (2026-07-11): el toggle es #user-menu-toggle;
    // el id #usermenu de versiones previas ya no existe.
    this.userMenu = page.locator('#user-menu-toggle');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login/index.php');
  }

  /** Login por el form real: Moodle exige el logintoken oculto — el form lo aporta solo. */
  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submit.click();
  }
}
