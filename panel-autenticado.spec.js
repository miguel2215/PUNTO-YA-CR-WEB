const { test, expect } = require('@playwright/test');

const EMAIL = process.env.TEST_B_EMAIL;
const PASSWORD = process.env.TEST_B_PASSWORD;
const WRITE_MODE = String(process.env.TEST_WRITE_MODE || '').toLowerCase() === 'true';

async function loginPanel(page) {
  test.skip(!EMAIL || !PASSWORD, 'Configura TEST_B_EMAIL y TEST_B_PASSWORD con un negocio de prueba propietario. Para probar PRO, TEST_B debe tener PRO activo.');
  await page.goto('/panel.html?access=login');
  await expect(page.locator('#panelLoginModal')).toBeVisible();
  await page.locator('#panelLoginEmail').fill(EMAIL);
  await page.locator('#panelLoginPassword').fill(PASSWORD);
  await page.locator('#panelLoginSubmit').click();
  await expect(page.locator('body')).toHaveClass(/panel-authenticated/, { timeout: 15000 });
  await expect(page.getByRole('button', { name: /Cerrar sesión/i }).first()).toBeVisible();
  await expect(page.locator('#resumen')).toBeVisible({ timeout: 15000 });
}

async function backToDashboard(page) {
  const back = page.getByRole('button', { name: /Volver al panel/i });
  if (await back.count()) {
    await back.first().click();
    await expect(page.locator('#resumen')).toBeVisible({ timeout: 15000 });
  }
}

test.describe('Panel del Emprendedor con sesión real', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop-chromium', 'Se ejecuta una sola vez en escritorio'));

  test('dashboard real y módulos base cargan con sesión', async ({ page }) => {
    await loginPanel(page);

    const modules = [
      ['Mi negocio', /MI NEGOCIO/i],
      ['Mi cuenta', /MI CUENTA/i],
      ['Dispositivos', /DISPOSITIVOS/i],
      ['Facturación', /FACTURACIÓN/i],
      ['Soporte', /SOPORTE/i]
    ];

    for (const [buttonName, eyebrow] of modules) {
      await page.getByRole('button', { name: new RegExp(buttonName, 'i') }).first().click();
      await expect(page.locator('.dashboard-eyebrow').filter({ hasText: eyebrow })).toBeVisible();
      await backToDashboard(page);
    }

    await page.getByRole('button', { name: /PUNTO YA CR (Free|Pro)|Estado de tu plan/i }).first().click();
    await expect(page.locator('body')).toContainText(/Tu plan|PUNTO YA CR (Free|Pro)/i);
  });

  test('módulos PRO cargan cuando el negocio de prueba tiene PRO', async ({ page }) => {
    await loginPanel(page);
    const isPro = await page.evaluate(() => Boolean(window.__panelIsPro));
    test.skip(!isPro, 'TEST_B debe ser un negocio PRO para probar Dinero, Crecimiento y Contabilidad');

    for (const [buttonName, heading] of [['Dinero','Dinero'],['Crecimiento','Crecimiento'],['Contabilidad','Contabilidad']]) {
      await page.getByRole('button', { name: new RegExp(`^${buttonName}$`, 'i') }).first().click();
      await expect(page.getByRole('heading', { name: new RegExp(`^${heading}$`, 'i') })).toBeVisible({ timeout: 15000 });
      await backToDashboard(page);
    }
  });

  test('guardar y restaurar un dato del negocio usando la interfaz', async ({ page }) => {
    test.skip(!WRITE_MODE, 'Activa TEST_WRITE_MODE=true solo con un negocio exclusivo de pruebas');
    await loginPanel(page);

    await page.getByRole('button', { name: /Mi negocio/i }).first().click();
    const phone = page.locator('#businessPhone');
    await expect(phone).toBeVisible();
    const original = await phone.inputValue();
    const marker = 'E2E-TEST-' + Date.now();

    await phone.fill(marker);
    await page.locator('#saveBusinessButton').click();
    await expect(page.locator('#businessSaveMessage')).toContainText(/Cambios guardados/i, { timeout: 15000 });

    await page.reload();
    await expect(page.locator('#resumen')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Mi negocio/i }).first().click();
    await expect(page.locator('#businessPhone')).toHaveValue(marker);

    await page.locator('#businessPhone').fill(original);
    await page.locator('#saveBusinessButton').click();
    await expect(page.locator('#businessSaveMessage')).toContainText(/Cambios guardados/i, { timeout: 15000 });
  });

  test('cerrar sesión elimina el acceso al panel autenticado', async ({ page }) => {
    await loginPanel(page);
    await page.getByRole('button', { name: /Cerrar sesión/i }).first().click();
    await expect(page).toHaveURL(/panel\.html/);
    await expect(page.getByRole('button', { name: /Iniciar sesión/i })).toBeVisible({ timeout: 15000 });
  });
});
