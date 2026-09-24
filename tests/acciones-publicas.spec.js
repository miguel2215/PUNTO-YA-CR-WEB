const { test, expect } = require('@playwright/test');

test('acciones comerciales principales tienen comportamiento', async ({ page }) => {
  await page.goto('/index.html');

  await expect(page.getByRole('link',{name:/Descubrir PUNTO YA CR Pro/i})).toHaveAttribute('href','#planes');
  await expect(page.getByRole('link',{name:/Ver mi negocio/i})).toHaveAttribute('href',/panel\.html\?access=login/);
  await expect(page.getByRole('link',{name:/Usar en Tablet/i})).toHaveAttribute('href',/^https:\/\//);

  await expect(page.getByText(/PRÓXIMAMENTE/i).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/Descargar para Android/i})).toHaveCount(0);

  const monthly = page.getByRole('link',{name:/Comprar PUNTO YA CR Pro mensual con Tilopay/i});
  await expect(monthly).toHaveAttribute('href','https://tp.cr/l/TnpReE1nPT18MQ==');
  await expect(page.getByRole('link',{name:/Comprar PUNTO YA CR Pro trimestral con Tilopay/i})).toHaveAttribute('href','https://tp.cr/l/TnpReE1RPT18MQ==');
  await expect(page.getByRole('link',{name:/Comprar PUNTO YA CR Pro anual con Tilopay/i})).toHaveAttribute('href','https://tp.cr/l/TnpReE1BPT18MQ==');
});

test('newsletter tiene campos y submit reales', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByLabel(/Tu correo electrónico/i)).toBeVisible();
  await expect(page.getByRole('button',{name:/Suscribirse/i})).toBeVisible();
});
