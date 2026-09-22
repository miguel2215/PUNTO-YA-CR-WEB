const { test, expect } = require('@playwright/test');

test('panel invitado tiene login, registro y acceso al POS', async ({ page }) => {
  await page.goto('/panel.html');
  await expect(page.getByRole('button',{name:/Iniciar sesión/i})).toBeVisible();
  await expect(page.getByRole('link',{name:/Crear mi negocio/i})).toBeVisible();
  await expect(page.getByRole('link',{name:/Abrir PUNTO YA CR/i})).toBeVisible();
});

test('modal login valida campos vacíos sin romper la página', async ({ page }) => {
  await page.goto('/panel.html?access=login');
  await page.getByRole('button',{name:/Iniciar sesión/i}).last().click();
  await expect(page.locator('#panelLoginError')).toContainText(/correo y contraseña/i);
});

test('panel no desborda horizontalmente en móvil', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone','Solo iPhone');
  await page.goto('/panel.html');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
