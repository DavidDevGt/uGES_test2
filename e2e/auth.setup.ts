import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { CREDS, ROLES, STORAGE } from './fixtures/roles';

/**
 * Proyecto "setup" (SPECS §4.1): autentica una vez por rol y persiste el storageState.
 * Todos los demás projects declaran dependencies: ['setup'] y reutilizan la sesión —
 * cero logins por UI dentro de los tests.
 */
for (const role of ROLES) {
  setup(`autenticar ${role}`, async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(CREDS[role].username, CREDS[role].password);

    // Assert real de sesión, no "la página navegó": el menú de usuario solo existe logueado.
    await expect(login.userMenu).toBeVisible();

    await page.context().storageState({ path: STORAGE[role] });
  });
}
