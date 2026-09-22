const { test, expect } = require('@playwright/test');

test('acciones comerciales principales tienen comportamiento', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page.getByRole('link',{name:/Descubrir PUNTO YA CR Pro/i})).toHaveAttribute('href','#planes');
  await expect(page.getByRole('link',{name:/Ver mi negocio/i})).toHaveAttribute('href',/panel\.html\?access=login/);
  await expect(page.getByRole('link',{name:/Usar en Tablet/i})).toHaveAttribute('href',/^https:\/\//);

  const android = page.getByRole('button',{name:/Descargar para Android/i});
  await android.click();
  await expect(page.locator('#publicNotice')).toContainText(/Android|Google Play/i);

  const monthly = page.getByRole('button',{name:/Pro mensual/i});
  await monthly.click();
  await expect(page.locator('#publicNotice')).toContainText(/pasarela oficial|código PRO/i);
});

test('newsletter tiene campos y submit reales', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByLabel(/Tu correo electrónico/i)).toBeVisible();
  await expect(page.getByRole('button',{name:/Suscribirse/i})).toBeVisible();
});
